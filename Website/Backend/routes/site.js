const express = require("express");
const { getSite } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(getSite());
});

module.exports = router;