const express = require("express");
var cors = require('cors');
const app = express();
const mysql = require("mysql");

app.use(cors());

const con = mysql.createConnection({
  host: "mysql.home.lan",
  user: "root",
  password: "raspberry",
  database: "homemedia",
});

app.get("/api/search/:searchTerm", function (req, res) {
  const searchTerm = "%" + req.params.searchTerm + "%";
  const sql =
    "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ?";
  con.query(sql, [searchTerm, searchTerm], function (err, result) {
    if (err) throw err;
    console.log(result);
    res.send(result);
  });
});

app.get("/api/top/media", function (req, res) {
  const sql =
    "SELECT * FROM videos order by id desc limit 21";
  con.query(sql, function (err, result) {
    if (err) throw err;
    console.log(result);
    res.send(result);
  });
});

app.get("/api/video/:id", function (req, res) {
  const id = req.params.id;
  const sql =
    "SELECT * FROM videos WHERE id = ?";
  con.query(sql, [id], function (err, result) {
    if (err) throw err;
    console.log(result);
    res.send(result);
  });
});

app.listen(8081, () => console.log('Listening on port 8081'));
