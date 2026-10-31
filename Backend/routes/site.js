const express = require("express");
const { getSite } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  res.json(await getSite());
});

module.exports = router;