var express = require("express");
var app = express();
var mysql = require("mysql");

var con = mysql.createConnection({
  host: "192.168.0.21",
  user: "root",
  password: "raspberry",
  database: "homemedia",
});

app.get("/api/search/:searchTerm", function (req, res) {
  con.connect(function (err) {
    if (err) throw err;
    var searchTerm = req.params.searchTerm;
    var sql =
      "SELECT title, cdn_path, uploaded, views FROM videos WHERE title LIKE '%?%' OR filename LIKE '%?%'";
    con.query(sql, [searchTerm, searchTerm], function (err, result) {
      if (err) throw err;
      console.log(result);
      res.send(result);
    });
  });
});
