// DEPRECATED FILE ONLY USED FOR SCRAP
//
//
// --------------------------------------------------------------


// Any term general CAB request:
// fetch("https://cab.brown.edu/api/?page=fose&route=search", {
//   "body": "%7B%22other%22%3A%7B%22srcdb%22%3A%22999999%22%7D%2C%22criteria%22%3A%5B%7B%22field%22%3A%22keyword%22%2C%22value%22%3A%22csci%22%7D%2C%7B%22field%22%3A%22is_ind_study%22%2C%22value%22%3A%22N%22%7D%2C%7B%22field%22%3A%22is_canc%22%2C%22value%22%3A%22N%22%7D%5D%7D",
//   "method": "POST",
// }).then(response => response.json()).then(data => out = data);
// body decoded:
// {"other":{"srcdb":"999999"},"criteria":[{"field":"keyword","value":"csci"},{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}

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
  var db_code = db_encode(season, year);
  var bod = '{"other":{"srcdb":"' + db_code + '"},"criteria":[{"field":"keyword","value":"' + String(keyword) + '"},{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}';
  await fetch("https://cab.brown.edu/api/?page=fose&route=search", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json()).then(data => {res = data});
  return res;
}



// Any term specific class inquiry:
// fetch("https://cab.brown.edu/api/?page=fose&route=search", {
//   "body": "%7B%22other%22%3A%7B%22srcdb%22%3A%22999999%22%7D%2C%22criteria%22%3A%5B%7B%22field%22%3A%22alias%22%2C%22value%22%3A%22csci%200320%22%7D%2C%7B%22field%22%3A%22is_ind_study%22%2C%22value%22%3A%22N%22%7D%2C%7B%22field%22%3A%22is_canc%22%2C%22value%22%3A%22N%22%7D%5D%7D",
//   "method": "POST",
// }).then(response => response.json()).then(data => out = data);
// body decoded:
// {"other":{"srcdb":"999999"},"criteria":[{"field":"alias","value":"csci 0320"},{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}

async function find_class(alias, season = 'any', year = 2021) {
  var res;
  var db_code = db_encode(season, year);
  var bod = '{"other":{"srcdb":"' + db_code + '"},"criteria":[{"field":"alias","value":"' + String(alias) + '"},{"field":"is_ind_study","value":"N"},{"field":"is_canc","value":"N"}]}';
  await fetch("https://cab.brown.edu/api/?page=fose&route=search", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json()).then(data => {res = data});
  return res;
}

// Any term specific class details:
// fetch("https://cab.brown.edu/api/?page=fose&route=details", {
//   "body": "%7B%22group%22%3A%22code%3ACSCI%200320%22%2C%22key%22%3A%22crn%3A16050%22%2C%22srcdb%22%3A%22202110%22%2C%22matched%22%3A%22crn%3A16050%22%7D",
//   "method": "POST",
// }).then(response => response.json()).then(data => out = data);
// body decoded:
// {"group":"code:CSCI 0320","key":"crn:16050","srcdb":"202110","matched":"crn:16050"}

async function get_details(code, crn, db_code) {
  var res;
  var bod = '{"group":"code:' + String(code) + '","key":"crn:' + String(crn) + '","srcdb":"' + '","matched":"crn:' + String(crn) + '"}';
  await fetch("https://cab.brown.edu/api/?page=fose&route=details", {
    "body": encodeURIComponent(bod),
    "method": "POST",
  }).then(response => response.json()).then(data => {res = data});
  return res;
}

// Using output of full class list (assuming storage into found_classes):
async function make_classes_dict(found_classes) {
  var classes = {};
  var regex = /code:(.*?)"/g;
  for (i in found_classes.results) {
    // console.log(found_classes.results[i].code);
    curr_class = found_classes.results[i];
    curr_class_details = await any_term_get_details(curr_class.code, curr_class.crn);
    if (classes[curr_class.code] && !curr_class_details.fatal) {
      // console.log("Adding to set");
      classes[curr_class.code].crns.add(curr_class.crn);

      reqs_string = curr_class_details.registration_restrictions;
      // reqs_arr = Array.from(reqs_string.matchAll(regex)).map(x => x[1]);
      // classes[curr_class.code].pre_reqs = new Set([...classes[curr_class.code].pre_reqs, ...reqs_arr]);
      classes[curr_class.code].pre_reqs = new Set([...reqs_string.split('and').map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1]))), ...classes[curr_class.code].pre_reqs]);

    } else if (!curr_class_details.fatal) {
      // console.log("Creating new set");
      classes[curr_class.code] = {};
      classes[curr_class.code].crns = new Set([curr_class.crn]);

      reqs_string = curr_class_details.registration_restrictions;
      // reqs_arr = Array.from(reqs_string.matchAll(regex)).map(x => x[1]);
      // classes[curr_class.code].pre_reqs = new Set(reqs_arr);
      classes[curr_class.code].pre_reqs = new Set(reqs_string.split('and').map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1]))));

      classes[curr_class.code].req_for = new Set();
    }
  }
  return classes;
}

// --------------------------------------------------------------------------------------

cs_classes = await any_term_get_courses("CSCI");
cs_class_dict = await make_classes_dict(cs_classes);

// for (var class_code in cs_class_dict) {
//   cs_class_dict[class_code].crns.forEach(class_crn => any_term_get_details(class_code, class_crn).then(deets => {
//     if (!deets.fatal) {
//       if (cs_class_dict[class_code].prereqs) {
//         cs_class_dict[class_code].prereqs.add(deets.registration_restrictions);
//       }
//       else {
//         cs_class_dict[class_code].prereqs = new Set(deets.registration_restrictions);
//       }
//     }
//   }));
// }

cs_classes = await any_term_get_courses("CSCI");
cs_class_dict = await make_classes_dict(cs_classes);

// new Set(a.registration_restrictions.split('and').map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1]))))

// var regex = /code:(.*?)"/g;
// Array.from(val.matchAll(regex))

for (var class_code in cs_class_dict) {
  cs_class_dict[class_code].pre_reqs.forEach(req_set => {
    req_set.forEach(req => {
      if (cs_class_dict[req]) {
        cs_class_dict[req].req_for = new Set([...cs_class_dict[req].req_for, class_code]);
      }
    })
  })
}

function Course(course_code) {
  this.course_code = course_code;
  this.instances = new Set();
  this.prereqs = new Set();
  this.add_instance = function (crn, db_code) {
    this.instance 
  }
}

function Course_Dict () {
  this.courses = {};
  this.add_course = function(course_code, )
}

async function make_classes_dict(found_classes) {
  var classes = new Course_Dict();
  var regex = /code:(.*?)"/g;
  for (i in found_classes.results) {
    // console.log(found_classes.results[i].code);
    curr_class = found_classes.results[i];
    curr_class_details = await any_term_get_details(curr_class.code, curr_class.crn);
    if (classes[curr_class.code] && !curr_class_details.fatal) {
      // console.log("Adding to set");
      classes[curr_class.code].crns.add(curr_class.crn);

      reqs_string = curr_class_details.registration_restrictions;
      // reqs_arr = Array.from(reqs_string.matchAll(regex)).map(x => x[1]);
      // classes[curr_class.code].pre_reqs = new Set([...classes[curr_class.code].pre_reqs, ...reqs_arr]);
      classes[curr_class.code].pre_reqs = new Set([...reqs_string.split('and').map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1]))), ...classes[curr_class.code].pre_reqs]);

    } else if (!curr_class_details.fatal) {
      // console.log("Creating new set");
      classes[curr_class.code] = {};
      classes[curr_class.code].crns = new Set([curr_class.crn]);

      reqs_string = curr_class_details.registration_restrictions;
      // reqs_arr = Array.from(reqs_string.matchAll(regex)).map(x => x[1]);
      // classes[curr_class.code].pre_reqs = new Set(reqs_arr);
      classes[curr_class.code].pre_reqs = new Set(reqs_string.split('and').map(x => new Set(Array.from(x.matchAll(regex)).map(x => x[1]))));

      classes[curr_class.code].req_for = new Set();
    }
  }
  return classes;
}