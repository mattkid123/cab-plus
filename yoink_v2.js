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
      throw 'Not one of the 5 options!';
  }
  return String(year_code) + season_code;
}

async function get_courses(keyword, season = 'any', year = 2021, db_code = null) {
  var res;
  var db = db_code ? db_code : db_encode(season, year);
  var bod = '{"other":{"srcdb":"' + db + '"},"criteria":[{"field":"keyword","value":"' + String(keyword) + '"},{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}';
  await fetch("https://cab.brown.edu/api/?page=fose&route=search", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json()).then(data => {res = data});
  return res;
}

async function get_details(code, crn, db_code = '999999') {
  var res;
  var bod = '{"group":"code:' + String(code) + '","key":"crn:' + String(crn) + '","srcdb":"' + db_code + '","matched":"crn:' + String(crn) + '"}';
  await fetch("https://cab.brown.edu/api/?page=fose&route=details", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json()).then(data => {res = data});
  return res;
}

function Course(course_code) {
  this.course_code = course_code;
  this.instances = [];
  this.pre_reqs = new Set();
  this.req_for = new Set();
  this.add_instance = async function (crn, db_code) {
    this.instances.push([crn, db_code]);
    let deets = await get_details(this.course_code, crn, db_code);
    let regex = /code:(.*?)"/g;
    this.pre_reqs = new Set([...deets.registration_restrictions.split('and')
      .map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1])))
      .filter(x => x.size > 0), ...this.pre_reqs]);
  }
  this.update_req_for = function (course_dict) {
    this.pre_reqs.forEach(req_set => req_set.forEach(pre_req => {
      if (course_dict.courses[pre_req]) {
        course_dict.courses[pre_req].req_for = new Set([this.course_code, ...course_dict.courses[pre_req].req_for]);
      }
    }))
  }
}

function Course_Dict () {
  this.courses = {};
  this.add_course = function (course_code, crn, db_code) {
    if (!this.courses[course_code]) {
      this.courses[course_code] = new Course(course_code);
    } 
    this.courses[course_code].add_instance(crn, db_code);
  }
  this.update_req_fors = function () {
    for (i in this.courses) {
      this.courses[i].update_req_for(this);
    }
  }
}

async function make_courses_dict(keyword, season = 'any', year = 2021) {
  var courses = await get_courses(keyword, season, year);
  course_dict = new Course_Dict();
  for (i in courses.results) {
    let course = courses.results[i];
    course_dict.add_course(course.code, course.crn, course.srcdb);
  }
  return course_dict;
}