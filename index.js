const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
// const nodemailer = require("nodemailer");
const port = process.env.PORT || 5000;

// // middleware;
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
// middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

// verify jwt
// validate jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unAuthorized Access" });
  }
  const token = authorization.split(" ")[1];
  // console.log(token);
  // token verify
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unAuthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.mzwsigq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// generate jwt token
app.post("/jwt", (req, res) => {
  const email = req.body;
  // console.log(email);
  const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "7d",
  });
  // console.log(token);
  res.send({ token });
});

async function run() {
  try {
    const usersCollection = client.db("healthyFit").collection("users");
    // sav user email and role in db
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDco = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDco,
        options
      );
      // console.log(result);
      res.send(result);
    });
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);
app.get("/", (req, res) => {
  res.send("Healthy Fit Server is running..");
});

app.listen(port, () => {
  console.log(`Healthy Fit is running on port ${port}`);
});
