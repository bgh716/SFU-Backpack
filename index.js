const express = require("express")
const session = require("express-session")
const bodyParser = require("body-parser")
const path = require("path")
const ejs = require("ejs")
const multer = require("multer")
const multerS3 = require("multer-s3")
const nodemailer = require("nodemailer")
const fs = require("fs")
const AWS = require("aws-sdk")
const AWS_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY
const EMAIL_ACCESS = process.env.EMAIL_PASS
const PORT = process.env.PORT || 5000
const Psession = require("connect-pg-simple")(session)
const { Pool } = require("pg")
var pool

var NodeGeocoder = require('node-geocoder');   // map

var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};

var geocoder = NodeGeocoder(options); /// google map geocoding

//user database access
pool = new Pool({
  connectionString:'postgres://postgres:SFU716!!qusrlgus@localhost/users' //-for keenan
  //connectionString:'postgres://postgres:cmpt276@localhost/postgres' //- for Jieung
  //connectionString: process.env.DATABASE_URL,
})

//login session access
var app = express()
app.use(
  session({
    store: new Psession({
      conString:'postgres://postgres:SFU716!!qusrlgus@localhost/postgres'
      //conString: process.env.DATABASE_URL,
      //conString:'postgres://postgres:cmpt276@localhost/postgres'
    }),
    secret: "!@SDF$@#SDF",
    resave: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
    saveUninitialized: true,
  })
)

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, "public")))
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "ejs")
app.get("/", (req, res) => res.render("pages/index"))


//check whether a user did log-in or not before accessing the mainpage to show different contents
app.get("/mainpage", (req, res) => {
  if (isLogedin(req, res)) {
    if (req.session.ID.trim() == "admin") {
      res.render("pages/mainpage", {
        uname: req.session.displayName,
        admin: true,
      })
    } else {
      res.render("pages/mainpage", {
        uname: req.session.displayName,
        admin: false,
      })
    }
  } else {
    res.render("pages/mainpage", { uname: false, admin: false })
  }
})

//path to sign-up page
app.get("/signUp", (req, res) => {
  res.render("pages/signUp")
})

//path to find pw page
app.get("/find_pw", (req, res) => {
  res.render("pages/find_pw")
})

//path to database page(shows every user information excerp for passwords)
app.get(
  "/fpowefmopverldioqwvyuwedvyuqwgvuycsdbjhxcyuqwdyuqwbjhcxyuhgqweyu",
  (req, res) => {
    var getUsersQuery = "SELECT * FROM backpack"
    pool.query(getUsersQuery, (error, result) => {
      if (error) res.end(error)
      var results = { rows: result.rows }
      res.render("pages/db", results)
    })
  }
)

//allowing the Admin to delete a user from backpack database
app.post("/admin_deleteUser", (req, res) => {
  var id = req.body.uid
  // delete this user id from the backpack database
  var getUsersQuery = "DELETE FROM backpack WHERE uid = '" + id + "'"
  pool.query(getUsersQuery, (error, result) => {
    if (error) res.end(error)
  })
  // go to the admin main page with the updated table (without the deleted user)
  res.redirect(
    "/fpowefmopverldioqwvyuwedvyuqwgvuycsdbjhxcyuqwdyuqwbjhcxyuhgqweyu"
  )
})

//Allows admin to delete improper posts
app.post("/admin_deletePost", (req, res) => {
  var uid = req.body.uid
  var bookname = req.body.bookname
  var coursename = req.body.coursename
  var values = [uid, bookname]
  if (uid && bookname) {
    //Delete the post that has this user id and bookname from the img database.
    pool.query(
      `DELETE FROM img WHERE uid=$1 AND bookname=$2`,
      values,
      (error, result) => {
        if (error) res.end(error)
        //After deleting, redirects user to the most recent course section from buying page.
        var redirect_to = "post/"
        res.redirect(redirect_to + coursename)
      }
    )
  }
})

app.get("/select_page/:id", (req, res) => {
  var postid = req.params.id;
  if (postid) {
    //Delete the post that has this user id and bookname from the img database.
    pool.query(
      `SELECT * FROM img WHERE postid=$1`,
      [postid],
      (error, result) => {
        if (error) {
          res.end(error)
        }
        var results = result.rows;
        var uidOnly = result.rows[0].uid;
        pool.query(`SELECT * FROM review WHERE about_user=$1`, [uidOnly], (error, result) => {
          if (error) {
            res.end(error);
          }
          var reviews = result.rows;
        if (isLogedin(req, res)) {
          // This is login and logout function
          if (req.session.ID.trim() == "admin") {
            res.render("pages/select", {
              results, reviews,
              uname: req.session.displayName,
              userID: req.session.ID,
              admin: true,
            })
          } else {
            res.render("pages/select", {
              results, reviews,
              uname: req.session.displayName,
              userID: req.session.ID,
              admin: false,
            })
          }
        } else {
          res.render("pages/select", { results, reviews, uname: false, admin: false, userID: req.session.ID })
        }
      });
      })
  }
})


//Posts the review written by the buyer
app.post("/post_review", (req, res) => {
  var uid = req.session.ID;
  var sellerid = req.body.sellerID;
  var review = req.body.review;
  var postID = req.body.postID;
  // current date + time
  var date_ob = new Date();
  var date = ("0" + date_ob.getDate()).slice(-2);
  var month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  var year = date_ob.getFullYear();
  var hours = date_ob.getHours();
  var minutes = date_ob.getMinutes();
  var seconds = date_ob.getSeconds();
  var timestamp = year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;

  var values = [timestamp, uid, sellerid, review];
  var uidOnly = [sellerid];
  var post_number = [postID];
  if (uid && sellerid && review) {
    //Inserting the review written to the database
    pool.query(`INSERT INTO review (date, written_user, about_user, description) VALUES ($1, $2, $3, $4)`, values, (error, result)=>{
      if (error)
        res.end(error)
      var backTo = "/select_page/" + postID;
      res.redirect(backTo);
    });
  }
})

//This page allows user to view what reviews he/she got from other users, and what reviews user haven written to others
app.get('/reviewpage', (req, res) => {
  var uid = req.session.ID;
  var value = [uid];

  // This is login and logout checking functino
  if (isLogedin(req, res)) {
    //Selects all the reviews that were written by the current user
    pool.query(`SELECT * FROM review WHERE written_user=$1`, value, (error, result) => {
      if (error)
        res.end(error)
      var my_reviews = result.rows;
      //Selects all the reviews that were written to the current user
      pool.query(`SELECT * FROM review WHERE about_user=$1`, value, (error, result) => {
        if (error)
          res.end(error)
        var other_reviews = result.rows;
        if (req.session.ID.trim() == "admin") {
          res.render("pages/reviews", {
            my_reviews, other_reviews,
            uname: req.session.displayName,
            admin: true,

          })
        } else {
          res.render("pages/reviews", {
            my_reviews, other_reviews,
              uname: req.session.displayName,
              admin: false,
            })
          }
        });
      });
    } else {
        //Redirects to the select page
        res.redirect("login")
      }
})

app.get("/login", (req, res) => {
  res.render("pages/login", {})
})

app.post("/auth/login", (req, res) => {
  var uid = req.body.uid
  var upassword = req.body.upassword
  var values = [uid, upassword]
  //find database if there is a user who matches with the given information
  if (uid && upassword) {
    pool.query(
      "SELECT * FROM backpack WHERE uid=$1 AND upassword=$2",
      values,
      (error, result) => {
          if (error) res.end(error)
          else if (!result || !result.rows[0]) {
          res.render("pages/login", {
            // if wrong password or ID
            msg: "Error: Wrong USER ID or PASSWORD!",
          })
        } else {
          //user information which was done log-in in a machine is saved
          req.session.displayName = result.rows[0].uname
          req.session.is_logined = true
          req.session.ID = result.rows[0].uid
          req.session.save(function () {
            res.redirect("/mainpage")
          })
        }
      }
    )
  }
})

app.get("/auth/logout", (req, res) => {
  req.session.destroy(function (err) {
    //destroy session information of the machine
    res.redirect("/mainpage")
  })
})

//check if a user did log-in or not
function isLogedin(req, res) {
  if (req.session.is_logined) {
    return true
  } else {
    return false
  }
}

//add user to database with given information
app.post("/adduser", (req, res) => {
  var uid = req.body.uid
  var uname = req.body.uname
  var uemail = req.body.uemail
  var upassword = req.body.upassword
  var upasswordcon = req.body.upasswordcon
  var checking = [uid, uemail]
  var values = [uid, uname, uemail, upassword]
  if (upassword === upasswordcon) {
    //check given password and password for confirmation are match

    if (uid && uname && uemail && upassword) {
      pool.query(
        "SELECT * FROM backpack WHERE uid=$1 OR uemail=$2",
        checking,
        (error, result) => {
          //user ID and email are unique, so need to check it
          if (error) {
            res.end(error)
          } else if (result && result.rows[0]) {
            res.render("pages/signUp", {
              // if the ID and the email already in database
              msg: "Error: USER ID or EMAIL is already taken!",
            })
          } else {
            pool.query(
              `INSERT INTO backpack (uid, uname, uemail, upassword) VALUES ($1,$2,$3,$4)`,
              values,
              (error, result) => {
                /*Edit Jieung*/
                if (error) res.end(error)
                else {
                  res.redirect("/login")
                }
              }
            )
          }
        }
      )
    }
  } else {
    res.render("pages/signUp", {
      // if the two password don't match
      msg: "Error: PASSWORD and CONFIRM PASSWORD have to match!",
    })
  }
})

//Allows user to delete their account permanently
app.post("/deleteuser", (req, res) => {
  var uid = req.body.uid //Requests values that are being modified from profile.ejs
  //var upassword = req.body.upassword;
  var checking = [uid]
  if (uid) {
    //If user id and password are given, find the user in the database table backpack
    pool.query(
      `SELECT * FROM backpack WHERE uid=$1`,
      checking,
      (error, result) => {
        if (error) res.end(error)
        else {
          //Once the data is gathered, delete the user from the database table backpack
          var insertUsersQuery = `DELETE FROM backpack WHERE uid=$1`
          pool.query(insertUsersQuery, checking, (error, result) => {
            if (error) res.end(error)
            else {
              //If succesfully deleted, the user is logged-out, deleted account then taken back to the mainpage
              req.session.destroy(function (err) {
                res.redirect("/mainpage")
              })
            }
          })
        }
      }
    )
  }
})

//Edit user's profile to requested values from the user.
app.post("/edituser", (req, res) => {
  if (!isLogedin(req, res)) {
    //If user is not logged-in, user is directed to login page
    res.redirect("/login")
    return false
  }
  var uid = req.body.uid //Requests values that are being modified from profile.ejs
  var uname = req.body.uname
  var uemail = req.body.uemail
  var upassword = req.body.upassword
  var confirm_pwd = req.body.confirm
  var values = [uid, uname, uemail, upassword]
  var uidOnly = [uid]

  if (uname && uemail && upassword && confirm_pwd) {
    if (confirm_pwd === upassword) {
      //Checks if user provided password matches the confirm password section
      //If do match, modifies the requested fields of the table with given values
      pool.query(
        `UPDATE backpack SET uname=$2, uemail=$3, upassword=$4 WHERE uid=$1`,
        values,
        (error, result) => {
          if (error) res.end(error)
          //Directs user back to the profile page.
          res.redirect("/mypage")
        }
      )
    }
  }
  //Error handling such as mismatch password or blank input given is handled in Javascript from profile.ejs
})

//function for who forgot his/her password. Shows password to user if given information is correct
app.post("/showpassword", (req, res) => {
  var uid = req.body.uid
  var uname = req.body.uname
  var uemail = req.body.uemail
  var values = [uid, uname, uemail]
  if (uid && uname && uemail) {
    pool.query(
      `SELECT * from backpack where uid=$1 AND uname=$2 AND uemail=$3`,
      values,
      (error, result) => {
        if (error) res.end(error)
        else if (!result || !result.rows[0]) {
          res.render("pages/find_pw", {
            // all the input enter have to be true to show the PASSWORD
            msg: "INFORMAION is not correct!",
          })
        } else {
          /*else{
                res.render('pages/find_pw', { // show the PASSWORD (the info is correct)
                      msg: "PASSWORD: " + result.rows[0].upassword
                });
            }*/
          const output = `
              <p>Dear User</p>
              <p>You have a lost Password request from backpack</p>
              <ul>
                <li> User Password: ${result.rows[0].upassword} </li>
              </ul>
            `

          // nodemail gmail transporter
          var transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: "cmpt276backpack@gmail.com",
              pass: EMAIL_ACCESS,
            },
          })

          // setup email data with unicode symbols
          let mailOptions = {
            from: '"backpack Website" <cmpt276backpack@gmail.com>', // sender address
            to: uemail, // list of receivers
            subject: "PASSWORD Request", // Subject line
            html: output, // html body
          }

          // send mail with defined transport object
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              return console.log(error)
            }
            res.render("pages/find_pw", { msg: "Email has been sent" })
          })
        }
      }
    )
  } else {
    res.render("pages/find_pw", {
      msg: "Entre your ID, Name and Email Address Please!",
    })
  }
})

//Profile page that shows information of logged-in user
app.get("/mypage", (req, res) => {
  if (!isLogedin(req, res)) {
    //If no user is logged-in, direct user to log-in page
    res.redirect("/login")
    return false
  }

  var uid = req.session.ID //Grabs an ID of the user signed-in
  var values = [uid]
  if (uid) {
    //If user id is given, take all data of user that matches the given ID
    pool.query(
      `SELECT * FROM backpack WHERE uid=$1`,
      values,
      (error, result) => {
        if (error) res.end(error)
        pool.query(
          `SELECT * FROM img WHERE uid=$1`,
          values,
          (error, img_result) => {
            if (error) res.end(error)
            else {
              //Sends the data to profile.ejs
              var results = { rows: result.rows, field: img_result.rows }
              res.render("pages/profile", results)
            }
          }
        )
      }
    )
  }
})

//Allows for image change in profile page
app.post("/changeImage", (req, res) => {
  var uimage = req.body.uimage //Requests values that are being modified from profile.ejs
  var uid = req.body.uid
  var values = [uimage, uid]
  var uidOnly = [uid]
  if (uimage && uid) {
    //Modifies database: uimage field is replaced with new image's filename and its type.
    pool.query(
      `UPDATE backpack SET uimage=$1 WHERE uid=$2`,
      values,
      (error, result) => {
        if (error) res.end(error)
        //Directs user back to the profile page with the changed image.
        res.redirect("/mypage")
      }
    )
  }
})

//function for who forgot his/her ID. Shows ID to user if given information is correct
app.post("/showid", (req, res) => {
  var uname = req.body.uname
  var uemail = req.body.uemail
  var values = [uname, uemail]
  if (uname && uemail) {
    pool.query(
      `SELECT * from backpack where uemail=$1 AND uname=$2`,
      values,
      (error, result) => {
        if (error) res.end(error)
        else if (!result || !result.rows[0]) {
          res.send(`INFORMAION is not correct!`)
        } else {
          res.send(result.rows[0].uid)
        }
      }
    )
  }
})

app.post("/mypage", (req, res) => {
  //Edit Jieung, new feature for profile.ejs
  var uid = req.body.uid
  var values = [uid]
  if (uid) {
    pool.query(
      `SELECT * FROM backpack WHERE uid=$1`,
      values,
      (error, result) => {
        if (error) res.end(error)
        else {
          var results = { rows: result.rows }
          res.render("pages/profile", results)
        }
      }
    )
  } else {
    res.send("Must log-in first")
  }
})

// Setting up Amazon Storage
AWS.config.update({
  accessKeyId: AWS_ID,
  secretAccessKey: AWS_SECRET,
  region: "us-west-2",
})
// initiate the storage
const S3 = new AWS.S3()

const upload = multer({
  // Create Multer-S3 Function for Storage
  storage: multerS3({
    s3: S3,
    acl: "public-read",
    bucket: "cmpt276-uploads",

    // Changing the file name to be unique (put the time and date instead of filename)
    key: function (req, file, cb) {
      cb(null, new Date().toISOString() + path.extname(file.originalname))
    },
  }),
  // Set default file size upload limit
  limits: { fileSize: 1024 * 1024 * 50 }, // 50MB

  // validation of the file extention
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|gif|png/
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    )
    const mimetype = filetypes.test(file.mimetype)
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb("Only jpeg/jpg/png images allowed")
    }
  },
})



app.get("/upload", (req, res) => {
  if (!isLogedin(req, res)) {
    //if user is not login direct them to login page
    res.redirect("/login")
    return false
  } else {
    res.render("pages/imageUpload") // else to upload page
  }
})


const image_upload = upload.single("myImage")
app.post("/upload", function (req, res) { // async function here
  image_upload(req, res, function (err) {
    if (err) {
      res.render("pages/imageUpload", {
        // if the file is not an image
        msg: err,
      })
    } else {
      if (req.file == undefined) {
        res.render("pages/imageUpload", {
          // if no file was selected
          msg: "Error: No File Selected!",
        })
      } else {

        geocoder.geocode(req.body.location, function (err, data){
          if (err || !data.length) {
            req.flash('error', 'Invalid address');
            return res.redirect('back')
          }

        var path = req.file.location
        var course = req.body.course.toLowerCase()
        var bookName = req.body.title
        var uid = req.session.ID
        var cost = req.body.cost
        var condition = req.body.condition
        var description = req.body.description
        var checking = [uid, bookName]
        var location = data[0].formattedAddress;  // location
        var lat = data[0].latitude;
        var lng = data[0].longitude;

        //Checks if user wanting to post already have the post with the same title
        //Different user can post with same title, but same user cannot post the same title
        pool.query(
          `SELECT * FROM img WHERE uid=$1 AND bookname=$2`,
          checking,
          (error, result) => {
            if (error) {
              res.render("pages/imageUpload", {
                // if the file is not an image
                msg: err,
              })
            }
            if (result && result.rows[0]) {
              res.render("pages/imageUpload", {
                //If same title exist for this user, return to selling page
                msg: "Error: User Already Posted Item with Same Title",
              })
            } else {
              // insert the user info into the img database (the image in AWS and the path of image in img database)
              var getImageQuery = `INSERT INTO img (course, path, bookname, uid, cost, condition, description, location, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
              // khoa comment out for testing
              // var getImageQuery =
              //   "INSERT INTO img (course, path, bookname, uid, cost, condition, description, location, lat, lng) VALUES('" +
              //   course +
              //   "','" +
              //   path +
              //   "','" +
              //   bookName +
              //   "','" +
              //   uid +
              //   "','" +
              //   cost +
              //   "','" +
              //   condition +
              //   "','" +
              //   description +
              //   "','" +
              //   location + "','" +lat +  "'',''" + lng +
              //   "')"

                ////////////////
              pool.query(getImageQuery, [course, path, bookName, uid, cost, condition, description, location, lat, lng], (error, result) => {
                if (error) {
                  res.end(error)
                } else {
                  res.render("pages/imageUpload", {
                    msg: "File Uploaded!", // Sending the path to the database and the image to AWS Storage
                  })
                }
              })
            }
          }
        ) // end query
      })
      }
    }
  })
})

app.get("/reportUser", (req, res) => {
  if (!isLogedin(req, res)) {
    //if user is not login direct them to login page
    res.redirect("/login")
    return false
  } else {
  res.render("pages/reportUser")
  }
})

///////////////////////////////////////////////////////////////////

app.post("/report", (req, res) => {
  //
  var id = req.body.uid
  var description = req.body.description
  var uid = req.session.ID

    var getEmailQuery = "SELECT * FROM backpack WHERE uid='" + id + "'"
    pool.query(getEmailQuery, (error, result) => {
      if (error) {
        res.end(error)
      }
      else if (!result || !result.rows[0]) {
        res.render("pages/reportUser", {
          msg: "INFORMAION about the User ID is not correct!",
        })
      }
    })
    var getEmailQuery = "SELECT * FROM backpack WHERE uid='" + uid + "'"
    pool.query(getEmailQuery, (error, result) => {
      if (error) {
        res.end(error)
      }
      else{
        const output = `
          <p> REPORT of USER: </p>
          <p>The User: ${uid} and email:${result.rows[0].uemail} has made a report against ${id} </p>
          <p> Report: ${description}</p>
        `
        // nodemail gmail transporter
        var transporter = nodemailer.createTransport({
          service: "gmail",
            auth: {
              user: "cmpt276backpack@gmail.com",
              pass: EMAIL_ACCESS,
            },
        })

        // setup email data with unicode symbols
        let mailOptions = {
          from: '"backpack Website" <cmpt276backpack@gmail.com>', // sender address
          to: 'cmpt276backpack@gmail.com', // list of receivers
          subject: "Reporting A User", // Subject line
          html: output, // html body
        }

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error)
          }
          res.render("pages/reportUser", { msg: "Report has been sent" })
        })
      }
    })
});


app.get("/find_id", (req, res) => {
  res.render("pages/find_id")
})

app.post("/sendEmail", (req, res) => {
  //get id and password and email
  var email = req.body.uemail
  if (email) {
    var getEmailQuery = "SELECT * FROM backpack WHERE uemail='" + email + "'"
    pool.query(getEmailQuery, (error, result) => {
      if (error) {
        res.end(error)
      } else if (!result || !result.rows[0]) {
        res.render("pages/find_id", {
          // all the input enter have to be true to show the PASSWORD
          msg: "INFORMAION is not correct!",
        })
      } else {
        //var results = {'rows':result.rows}
        const output = `
            <p>Dear User</p>
            <p>You have a lost ID and Password request from backpack</p>
            <ul>
              <li> User ID: ${result.rows[0].uid} </li>
              <li> User Password: ${result.rows[0].upassword} </li>
            </ul>
          `

        // nodemail gmail transporter
        var transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "cmpt276backpack@gmail.com",
            pass: EMAIL_ACCESS,
          },
        })

        // setup email data with unicode symbols
        let mailOptions = {
          from: '"backpack Website" <cmpt276backpack@gmail.com>', // sender address
          to: email, // list of receivers
          subject: "ID and PASSWORD Request", // Subject line
          html: output, // html body
        }

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error)
          }
          console.log("Message sent")

          res.render("pages/find_id", { msg: "Email has been sent" })
        })
      }
    })
  } else {
    res.render("pages/find_id", { msg: "Entre your Email Address Please!" })
  }
})

//  BUYINGPAGE WORK HERE - ASK ME IF THERE IS ANY PROBLEMS - khoa
app.get("/buy", (req, res) => {
  // This will return a first buying page and have login function
  var getUsersQuery = `SELECT * FROM img`
  pool.query(getUsersQuery, (error, result) => {
    if (error) {
      res.end(error)
    }
    var results = result.rows

    if (isLogedin(req, res)) {
      // This is login and logout function
      if (req.session.ID.trim() == "admin") {
        res.render("pages/buyingpage", {
          results,
          uname: req.session.displayName,
          admin: true,
        })

      } else {
        res.render("pages/buyingpage", {
          results,
          uname: req.session.displayName,
          admin: false,
        })
      }
    } else {
      res.render("pages/buyingpage", { results, uname: false, admin: false })
    }
  })
})

app.get("/post/:id", (req, res) => {
  // This will lead to books with specific course
  var cname = req.params.id // Get data from course name
  pool.query(`SELECT * FROM img WHERE course=$1`, [cname], (error, result) => {
    if (error) {
      res.end(error)
    }
    var results = result.rows // Will return data from img table

    if (isLogedin(req, res)) {
      // This is login and logout function
      if (req.session.ID.trim() == "admin") {
        res.render("pages/buyingPageReload", {
          results,
          uname: req.session.displayName,
          admin: true,
        })
      } else {
        res.render("pages/buyingPageReload", {
          results,
          uname: req.session.displayName,
          admin: false,
        })
      }
    } else {
      res.render("pages/buyingPageReload", {
        results,
        uname: false,
        admin: false,
      })
    }
  })
})
//socket server code starts//
var socket = require("socket.io")
var http = require("http")
var server = http.createServer(app)
var io = socket(server, { path: "/socket.io" })

//move to chatting page
app.post("/chat", (req, res)=> {
    if(isLogedin(req, res)) {
        var receiver=req.body.receiver; //opponent client information
        if(!receiver){
            res.redirect("/mainpage");
        }
        else{
            pool.query(`SELECT * FROM chatlist WHERE (sender=$1 AND receiver=$2) OR (sender=$2 AND receiver=$1)`,[receiver, req.session.ID], (error,result)=>{ //find previous chatting logs
                if(error){
                    res.end(error);
                }
                if (!result || !result.rows[0]) {
                    res.render("pages/chat",{uname: req.session.displayName, db:false, receiver:receiver, sender:req.session.ID});
                }
                else{
                    var results = result.rows;
                    res.render("pages/chat",{uname: req.session.displayName, db:true ,results, receiver:receiver, sender:req.session.ID});
                }
            })
        }
    }
    else{
        res.redirect("/login");
    }
})

//move to chatting list page. Users can see the every chatting rooms of user involved
app.get("/chatlist", (req, res)=>{
    var admin;
    if(isLogedin(req, res)) {
        pool.query(`SELECT * FROM chatlist WHERE (receiver=$1 OR sender=$1)`,[req.session.ID], (error,result)=>{ //find chatting logs which the user involved
            if(error){
                res.end(error);
            }

            if (req.session.ID.trim() == "admin") {
                admin=true;
            }
            else{
                admin=false;
            }

            if (!result || !result.rows[0]) {
                res.render("pages/chatlist",{db:false,  uname:req.session.displayName, admin});
            }
            else{
                var results = result.rows;
                res.render("pages/chatlist",{uid:req.session.ID,db:true ,results, uname:req.session.displayName, admin});
            }
        })
    }
    else{
        res.redirect("/login");
    }
})

io.sockets.on("connection", function (socket) {
    socket.on("username", function (username) {
        socket.username = username;//user's name
    })
    socket.on("receiver", function(receiver){
        socket.receiver=receiver;//opponent
    })
    socket.on("sender", function(sender){
        socket.sender=sender;//user
    })
    socket.on("room", function(room){
        socket.join(room);//private room
        socket.room=room;
    })
    socket.on("chat_message", function(message){
        io.in(socket.room).emit("chat_message", "<strong>" + socket.username + "</strong>: " + message);
        pool.query(`INSERT INTO chatlist (receiver, sender, texts, senderID) VALUES ($1, $2, $3, $4)`,[socket.receiver,socket.sender, message, socket.username], (error, result)=>{ //saves chatting logs
            if(error){
                throw(error);
            }
        })
    })
})
//socket server code end//

///////////////////////////////

// SEARCH //////////
function search(search_string, func) {
  pool.query( "SELECT * FROM img WHERE fts @@ to_tsquery('english', $1)", [search_string],
  function(err, result) {
    if (err) {
      func([])
    } else {
      func(result.rows)
    }
  }
  );
}
app.get('/search', function(req, res) {
  if (typeof req.query.text !== 'undefined') {
      search(req.query.text, function(data_items) {
        var results = data_items
        if (isLogedin(req,res)){
          if (req.session.ID.trim() == "admin"){
            res.render("pages/searchReload", {
              results,
              uname: req.session.displayName,
              admin: true,
            })
          }
          else {
            res.render("pages/searchReload",{
              results,
              uname: req.session.displayName,
              admin: true,
            })
          }
        }
        else{
          res.render("pages/searchReload", {results, uname: false, admin: false})
        }
      })
  } else {
     res.redirect("pages/buyingpageReload")
  }
})




server.listen(PORT, () => console.log(`Listening on ${PORT}`))

module.exports = app;