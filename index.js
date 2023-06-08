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

async function run() {
  try {
    const usersCollection = client.db("healthyFit").collection("users");
    const classesCollection = client.db("healthyFit").collection("class");

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
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    // user related apis
    app.get(
      "/users",
      verifyJWT,
      verifyAdmin,
      // verifyInstructor,
      async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      }
    );
    // update user admin

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Make Instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

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

    // Manage Classes route
    app.get("/admin/classes", verifyJWT, async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.send(classes);
      } catch (err) {
        console.error("Error retrieving classes from the database", err);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Approve Class
    app.put("/admin/classes/:id/approve", verifyJWT, async (req, res) => {
      const classId = req.params.id;
      try {
        const result = await classesCollection.updateOne(
          { _id: ObjectId(classId) },
          { $set: { status: "approved" } }
        );
        res.send(result);
        res.json({ message: "Class approved" });
      } catch (err) {
        console.error("Error updating class status in the database", err);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Deny Class
    app.put("/admin/classes/:id/deny", verifyJWT, async (req, res) => {
      const classId = req.params.id;
      try {
        const result = await classesCollection.updateOne(
          { _id: ObjectId(classId) },
          { $set: { status: "denied" } }
        );
        res.send(result);
        res.json({ message: "Class denied" });
      } catch (err) {
        console.error("Error updating class status in the database", err);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Send Feedback
    app.post("/admin/classes/:id/feedback", verifyJWT, async (req, res) => {
      const classId = req.params.id;
      const feedback = req.body.feedback;

      // Code for sending feedback to the instructor

      res.json({ message: "Feedback sent" });
    });

    // save a room in database
    app.post("/class", async (req, res) => {
      const classesData = req.body;
      // console.log(room);
      const result = await classesCollection.insertOne(classesData);
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
