<<<<<<< HEAD
=======
<<<<<<< HEAD
=======
// tests here
console.log("hello world");

/*
>>>>>>> 52bfbcf81fb2c5e3a7c66a60ce0cd306ed4257e5
var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../index');
var should = chai.should();

chai.use(chaiHttp);
<<<<<<< HEAD

describe('Reviews', function() {
  //Test Associated With Reviews
  it('should add a review with date, written user and receiving user associated on a successful POST request for /post_review', function(done) {
    chai.request(server).get('/reviewpage').end(function(error, res) {
      var num_review_written_0 = res.body.length;
      chai.request(server).post('/post_review').send({'sellerID':'1234', 'review':'Good Book'})
        .end(function(error, res) {
          var num_review_written_1 = res.body.length;
          res.body[0].Written_by.should.equal('123');
          res.body[0].About_user.should.equal('1234');
          res.body[0].Review.should.equal('Good Book');
          (num_review_written_1 - num_review_written_0).should.equal(1);
         });
    });
    done();
  })

  it('fail report', function(done) {
    chai.request(server).post('/report').send({'uid':'1234', 'description':'Good Book'})
      .end(function(error, res) {
        console.log(res.body);
        res.should.have.status(200);
        res.body[0].id.should.equal('123');
        res.body[0].description.should.equal('Good Book');
      });
      done();
  })
});
=======
//ob={'r':socket.receiver,'s':socket.sender,'m':message,'u':socket.username};
describe('User', function () {
    //tests associated with users
    it('should add a single user on a successful adding request for chatting message', function (done) {
        chai.request(server).post('/chat').send({ 'receiver': '111'});
        chai.end(function(error,res){
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');
            res.body[0].r.should.equal('111');
            res.body[0].u.should.equal('helloworld');
            done();
        });
    });
});
*/
>>>>>>> 52bfbcf81fb2c5e3a7c66a60ce0cd306ed4257e5
>>>>>>> e5fbc747eba51f1e5884303d09b2ac37df25dccd
