const express = require("express");
var cors = require("cors");
const app = express();
const mysql = require("mysql2");

app.use(cors());
app.use(express.json());

const con = mysql.createPool({
  host: "mysql.home.lan",
  user: "root",
  password: "raspberry",
  database: "homemedia",
  connectionLimit: 10,
});

app.get("/api/search/:searchTerm", function (req, res) {
  con.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting database connection", err);
      return res.status(500).json({ error: "Database error" });
    }

    const searchTerm = "%" + req.params.searchTerm + "%";
    const sql = "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ?";
    connection.query(sql, [searchTerm, searchTerm], function (err, result) {
      if (err) throw err;
      console.log(result);
      res.send(result);
      
      connection.releaseConnection();
    });
  });
});

app.get("/api/top/media", function (req, res) {
  con.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting database connection", err);
      return res.status(500).json({ error: "Database error" });
    }

    const sql = "SELECT * FROM videos order by id desc limit 21";
    connection.query(sql, function (err, result) {
      if (err) {
        console.error("Error getting top media from database", err);
        return res.status(500).json({ error: "Database error" });
      }
      console.log(result);
      res.send(result);

      connection.releaseConnection();
    });
  });
});

app.get("/api/video/:id", function (req, res) {
  con.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting database connection", err);
      return res.status(500).json({ error: "Database error" });
    }

    const id = req.params.id;
    const sql = "SELECT * FROM videos WHERE id = ?";
    connection.query(sql, [id], function (err, result) {
      if (err) {
        console.error(
          "Error getting video by id from database connection",
          err
        );
        return res.status(500).json({ error: "Database error" });
      }
      console.log(result);
      res.send(result);

      connection.releaseConnection();
    });
  });
});

app.post("/api/video/:id", function (req, res) {
  con.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting database connection", err);
      return res.status(500).json({ error: "Database error" });
    }

    const id = req.params.id;
    const title = req.body.title;
    var sql = "UPDATE videos SET title = ? WHERE id = ?";
    connection.query(sql, [title, id], function (err, result) {
      if (err) {
        console.error("Error updating video", err);
        return res.status(500).json({ error: "Database error" });
      }
      console.log(result.affectedRows + " record(s) updated");
      res.send(req.body);

      connection.releaseConnection();
    });
  });
});

app.listen(8081, () => console.log("Listening on port 8081"));
