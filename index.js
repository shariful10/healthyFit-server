const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");

const cors = require("cors");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
// const nodemailer = require("nodemailer");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
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
    const featuredClassCollection = client
      .db("healthyFit")
      .collection("featuredClass");
    const bookedCourseCollection = client.db("healthyFit").collection("course");
    const paymentsCollection = client.db("healthyFit").collection("payment");

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
      console.log(user);
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
      console.log(user);
      console.log(user);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    // user related apis
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // update user admin

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false } || { instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" } || {
        instructor: user?.role === "instructor",
      };
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

    app.patch(
      "/users/instructor/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "instructor",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.put("/users/:email", verifyJWT, async (req, res) => {
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

    app.get("/all-class", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    app.get("/update-class/:id", async (req, res) => {
      const result = await classesCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // save a Class in database
    app.post("/class", async (req, res) => {
      const classesData = req.body;
      // console.log(room);
      const result = await classesCollection.insertOne(classesData);
      res.send(result);
    });
    // Manage Classes route
    app.get("/users/classes", async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.send(classes);
      } catch (err) {
        console.error("Error retrieving classes from the database", err);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Approve Class
    app.put("/classes/:id/approve", async (req, res) => {
      const classId = req.params.id;

      // Update the class status to approved
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        { $set: { status: "approved" } }
      );

      res.send(result);
    });

    app.put("/classes/:id/deny", async (req, res) => {
      const classId = req.params.id;

      // Update the class status to denied
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        { $set: { status: "denied" } }
      );
      res.send(result);
    });

    // Add feedback to a class
    app.patch("/classes/:classId/feedback", async (req, res) => {
      const classId = req.params.classId;
      const { feedback } = req.body;
      console.log(feedback);
      // Update the class with the feedback
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        {
          $set: { feedback: feedback },
        }
      );

      res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      try {
        // Retrieve the instructor data
        const instructors = await classesCollection
          .find()
          .project({ instructor: { name: 1, image: 1, email: 1 } })
          .toArray();

        // Send the instructor data as a response
        res.send(instructors);
      } catch (error) {
        console.error("Error retrieving instructors:", error);
        res.status(500).json({ error: "Failed to retrieve instructors" });
      }
    });

    app.post("/select-class", async (req, res) => {
      const classes = req.body;
      console.log(classes);
      const result = await bookedCourseCollection.insertOne(classes);
      res.send(result);
    });
    // get  mu class for instructors
    app.get("/my-class", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Update A class
    app.put("/classUpdate/:id", async (req, res) => {
      const classUpdate = req.body;

      const filter = { _id: new ObjectId(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: classUpdate,
      };
      const result = await classesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // API endpoint to get selected classes for a student
    app.get("/student/classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      // console.log({ decodedEmail });
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await bookedCourseCollection.find(query).toArray();
      res.send(result);
    });

    // API endpoint to remove a selected class
    app.delete("/student/classes/:id", async (req, res) => {
      const id = req.params.id;
      console.log(req.params);
      // Delete the selected class for the student
      const result = await bookedCourseCollection.deleteOne({
        _id: new ObjectId(id),
      });
      console.log(result);
      res.send(result);
    });

    //payment stipe impliment here
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //payment api to save database ,remove classes ,enrolled added
    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;
      const insertResult = await paymentsCollection.insertOne(paymentInfo);
      console.log(paymentInfo);
      const query = {
        _id: new ObjectId(paymentInfo.classId),
      };
      const removeResult = await classesCollection.deleteOne(query);
      // const enrolledResult = await enrolledCollection.insertOne(paymentInfo);
      res.send({ insertResult, removeResult });
    });

    // Retrieve payment history for a student
    app.get("/student/payment-history", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
        return;
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      const query = { email: email };
      const result = await paymentHistoryCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/featured-class", async (req, res) => {
      const result = await featuredClassCollection.find().toArray();
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
