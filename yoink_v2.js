const fetch = require('node-fetch');

function db_encode(season, year) {
  var season_code;
  var year_code;
  switch(season) {
    case 'win':
      season_code = '15';
      year_code = year - 1;
      break;
    case 'spr':
      season_code = '20';
      year_code = year - 1;
      break;
    case 'fal':
      season_code = '10';
      year_code = year;
      break;
    case 'sum':
      season_code = '00';
      year_code = year;
      break;
    case 'any':
      return '999999';
      break;
    default:
      throw "Not one of the 5 options!";
  }
  return String(year_code) + season_code;
}

function get_many_dbs() {
  var seasons = ['sum', 'fal', 'win', 'spr'];
  var years = [2019, 2020, 2021, 2022];
  var dbs = [];
  for (s in seasons) {
    for (y in years) {
      dbs.push(db_encode(seasons[s], years[y]));
    }
  }
  return dbs;
}

function isEmpty(obj) {
  var res = true;
  for (i in obj) {
    return false;
  }
  return res;
}

function countItems(obj) {
  var res = 0;
  for (i in obj) {
    ++res;
  }
  return res;
}

async function get_courses(keyword, season = 'any', year = 2021, db_code = null) {
  var db = db_code ? db_code : db_encode(season, year);
  var bod = '{"other":{"srcdb":"' + db + '"},"criteria":[{"field":"keyword","value":"' + String(keyword) + '"},{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}';
  return await fetch("https://cab.brown.edu/api/?page=fose&route=search", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json());
}

async function get_all_db_courses(db = '999999') {
  var bod = '{"other":{"srcdb":"' + String(db) + '"},"criteria":[{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}';
  return await fetch("https://cab.brown.edu/api/?page=fose&route=search", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json());
}

async function get_details(code, crn, db_code = '999999') {
  var bod = '{"group":"code:' + String(code) + '","key":"crn:' + String(crn) + '","srcdb":"' + db_code + '","matched":"crn:' + String(crn) + '"}';
  return await fetch("https://cab.brown.edu/api/?page=fose&route=details", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json());
}

function Course(course_code) {
  this.course_code = course_code;
  this.instances = [];
  this.title = undefined;
  this.pre_reqs = new Set();
  this.req_for = new Set();
  this.add_instance = async function (crn, db_code) {
    this.instances.push([crn, db_code]);
    let deets = await get_details(this.course_code, crn, db_code);
    if (deets.fatal) {
      throw "No details could be found for: " + this.course_code + " " + crn + " " + db_code;
    }
    let regex = /code:(.*?)"/g;
    this.pre_reqs = new Set([...deets.registration_restrictions.split('and')
      .map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1])))
      .filter(x => x.size > 0), ...this.pre_reqs]); // TODO: Sets of sets are broken (see DL)
  }
  this.update_req_for = function (course_dict) {
    this.pre_reqs.forEach(req_set => req_set.forEach(pre_req => {
      if (course_dict.courses[pre_req]) {
        course_dict.courses[pre_req].req_for = new Set([this.course_code, ...course_dict.courses[pre_req].req_for]);
      } // TODO: if we cant access them we should find a way to add them.
    }))
  }
}

function Course_Dict () {
  this.courses = {};
  this.add_course = function (course_code, crn, db_code, title = undefined) {
    if (!this.courses[course_code]) {
      this.courses[course_code] = new Course(course_code);
      this.courses[course_code].title = title;
    } 
    this.courses[course_code].add_instance(crn, db_code);
  }
  this.update_req_fors = function () {
    for (i in this.courses) {
      this.courses[i].update_req_for(this);
    }
  }
}

async function make_course_dict(keyword, season = 'any', year = 2021) {
  var courses = await get_courses(keyword, season, year);
  if (courses.fatal) {
    throw "No courses could be found for: " + keyword + " " + season + " " + year;
  }
  var course_dict = new Course_Dict();
  for (i in courses.results) {
    let course = courses.results[i];
    course_dict.add_course(course.code, course.crn, course.srcdb, course.title);
  }
  return course_dict;
}

async function make_course_dict_manydbs(keyword) {
  var course_dict = new Course_Dict();
  var dbs = get_many_dbs();
  for (db in dbs) {
    let courses = await get_courses(keyword, undefined, undefined, dbs[db]);
    if (courses.fatal) {
      continue;
    }
    for (i in courses.results) {
      let course = courses.results[i];
      course_dict.add_course(course.code, course.crn, course.srcdb, course.title);
    }
  }
  if (isEmpty(course_dict.courses)) {
    throw "Nothing found in any db for: " + keyword;
  } else {
    return course_dict;
  }
}

async function make_all_course_dict() {
  var course_dict = new Course_Dict();
  var dbs = get_many_dbs();
  for (db in dbs) {
    let courses = await get_all_db_courses(dbs[db]);
    if (courses.fatal) {
      continue;
    }
    for (i in courses.results) {
      let course = courses.results[i];
      course_dict.add_course(course.code, course.crn, course.srcdb, course.title);
    }
  }
  if (isEmpty(course_dict.courses)) {
    throw "Nothing found in any db for: " + keyword;
  } else {
    return course_dict;
  }
}


// TESTS FOR NOW

async function main() {
  // cs = await make_course_dict_manydbs('csci');
  // cs.update_req_fors();
  // console.log(countItems(cs.courses));
  all_courses = await make_all_course_dict();
  all_courses.update_req_fors();
  console.log(countItems(all_courses.courses));
  console.log(Array.from(all_courses.courses['CSCI 0320'].req_for).map(x => [x, all_courses.courses[x].title]));
}

main();