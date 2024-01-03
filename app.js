const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv").config();
const saltRounds = 10; // Number of salt rounds
const fs = require("fs");
const bodyParser = require("body-parser");
const multer = require("multer");
const pool = require("./db");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

const port = process.env.PORT || 3000;

app.use(
  session({
    secret: crypto.randomBytes(64).toString("hex"), // New secret key for sessions
    resave: true,
    saveUninitialized: true,
  })
);

// Multer configuration for handling file uploads (images)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads"); // Set your images directory
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Loging in

// ...

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const [results, fields] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    req.session.userId = user.userId;
    req.session.username = user.username;
    req.session.landlordId = user.landlordId;

    req.session.save((err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error saving session" });
      } else {
        let redirectURL = "/"; // Define default redirect URL
        if (user.role === "tenant") {
          redirectURL = "/tenant";
        } else if (user.role === "landlord") {
          redirectURL = "/landlord";
        }
        res.status(200).json({ redirect: redirectURL });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error during login" });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).send("Incomplete data");
    }

    const hashedPassword = await hashPassword(password);
    pool
      .execute(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword]
      )
      .then(() => {
        res.render("login");
      })
      .catch((error) => {
        console.error("Error registering user:", error);
        res.status(500).send("Error registering user");
      });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error registering user");
  }
});

app.get("/", (req, res) => {
  const data = {
    title: "home",
    active: "home",
  };
  res.render("index", data);
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/tenant", (req, res) => {
  res.render("tenant");
});

app.get("/landlord", (req, res) => {
  res.render("landlord");
});

app.get("/landlord/landlord_profile", async (req, res) => {
  try {
    const userId = req.session.userId;
    const username = req.session.username; // Assuming username is available in the session

    // Fetch the user's profile data from the landlords table
    const [profileData] = await pool.execute(
      "SELECT * FROM landlords WHERE userId = ?",
      [userId]
    );

    // Render the tenant_profile view and pass the profile and username data
    res.render("landlord_profile", { profile: profileData[0], username });
  } catch (error) {
    console.error("Error fetching landlord profile:", error);
    res.status(500).send("Error fetching landlord profile");
  }
});

app.post(
  "/landlord/landlord_profile",
  [
    // Validation and sanitization for form fields
    body("fname").trim().escape(),
    body("lname").trim().escape(),
    body("phone").trim().escape(),
  ],
  async (req, res) => {
    try {
      // Handle validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fname, lname, phone } = req.body;
      const userId = req.session.userId;

      // Check if the user's profile already exists in the landlords table
      const [existingProfile] = await pool.execute(
        "SELECT * FROM landlords WHERE userId = ?",
        [userId]
      );

      if (existingProfile.length === 0) {
        // If the profile doesn't exist, insert a new one
        await pool.execute(
          "INSERT INTO landlords (userId, fname, lname, phone) VALUES (?, ?, ?, ?)",
          [userId, fname, lname, phone]
        );
      } else {
        // If the profile exists, update the existing profile
        await pool.execute(
          "UPDATE landlords SET fname = ?, lname = ?, phone = ? WHERE userId = ?",
          [fname, lname, phone, userId]
        );
      }

      // Return success message upon successful profile update/insert
      res.redirect("/landlord/landlord_profile");
    } catch (error) {
      console.error("Error updating/inserting landlord profile:", error);
      res
        .status(500)
        .send("Error updating/inserting landlord profile. Please try again.");
    }
  }
);

app.get("/admin", (req, res) => {
  res.render("admin");
});

app.get("/admin/add_landlord", (req, res) => {
  res.render("add_landlord");
});

app.get("/tenant/tenant_profile", async (req, res) => {
  try {
    const userId = req.session.userId;
    const username = req.session.username; // Assuming username is available in the session

    // Fetch the user's profile data from the tenants table
    const [profileData] = await pool.execute(
      "SELECT * FROM tenants WHERE userId = ?",
      [userId]
    );

    // Render the tenant_profile view and pass the profile and username data
    res.render("tenant_profile", { profile: profileData[0], username });
  } catch (error) {
    console.error("Error fetching tenant profile:", error);
    res.status(500).send("Error fetching tenant profile");
  }
});

app.post(
  "/tenant/tenant_profile",
  [
    // Validation and sanitization for form fields
    body("fname").trim().escape(),
    body("lname").trim().escape(),
    body("gender").trim().escape(),
    body("phone").trim().escape(),
    body("university").trim().escape(),
  ],
  async (req, res) => {
    try {
      // Handle validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fname, lname, gender, phone, university } = req.body;
      const userId = req.session.userId;

      // Check if the user's profile already exists in the tenants table
      const [existingProfile] = await pool.execute(
        "SELECT * FROM tenants WHERE userId = ?",
        [userId]
      );

      if (existingProfile.length === 0) {
        // If the profile doesn't exist, insert a new one
        await pool.execute(
          "INSERT INTO tenants (userId, fname, lname, gender, phone, university) VALUES (?, ?, ?, ?, ?, ?)",
          [userId, fname, lname, gender, phone, university]
        );
      } else {
        // If the profile exists, update the existing profile
        await pool.execute(
          "UPDATE tenants SET fname = ?, lname = ?, gender = ?, phone = ?, university = ? WHERE userId = ?",
          [fname, lname, gender, phone, university, userId]
        );
      }

      // Return success message upon successful profile update/insert
      res.redirect("/tenant/tenant_profile");
    } catch (error) {
      console.error("Error updating/inserting tenant profile:", error);
      res
        .status(500)
        .send("Error updating/inserting tenant profile. Please try again.");
    }
  }
);

// Adding Landlord in database
app.post("/add_landlord", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const hashedPassword = await hashPassword(password);

    if (role === "landlord") {
      await pool.execute(
        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
        [username, email, hashedPassword, role]
      );
    } else {
      await pool.execute(
        "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
        [username, email, hashedPassword, "tenant"]
      );
    }

    res.status(200).send("User registered successfully");
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send("Error registering user");
  }
});

// Delete User

app.get("/admin/delete_user", async (req, res) => {
  try {
    // Fetch all users from the database
    const [users] = await pool.query("SELECT * FROM users");

    // Separate users by role (landlords and tenants)
    const landlords = users.filter((user) => user.role === "landlord");
    const tenants = users.filter((user) => user.role === "tenant");

    // Render the delete_users view and pass the users data
    res.render("delete_user", { landlords, tenants }); // Pass landlords and tenants data to the template
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Error fetching users");
  }
});

// Endpoint to handle user deletion
app.post("/admin/delete_user", async (req, res) => {
  try {
    const userIdToDelete = req.body.userId;

    // Check if the user ID exists
    if (!userIdToDelete) {
      return res.status(400).send("Invalid user ID");
    }

    // Delete the user from the database
    await pool.query("DELETE FROM users WHERE userId = ?", [userIdToDelete]);

    res.redirect("/admin/delete_user");
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send("Error deleting user");
  }
});

app.get("/landlord/add_hostel", (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    console.error("User ID not found");
    return res.status(403).send("Unauthorized");
  }
  res.render("add_hostel", { error: null });
});

// GET route to render the form
app.get('/landlord/add_hostel', (req, res) => {
  // Render your form here
  res.render('add_hostel', { error: null });
});

// POST route to add the hostel to the database
app.post('/landlord/add_hostel', upload.array('images', 5), async (req, res) => {
  try {
    const {
      name,
      location,
      price,
      availability,
      gender,
      phone,
      description,
    } = req.body;

    // Assuming you have a userId in the session
    const userId = req.session.userId;

    // Add your validation and processing logic here

    // Example SQL query to insert the hostel into the database
    const insertQuery = `INSERT INTO hostels (userId, name, location, price, availability, gender, phone, description) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const [results, fields] = await pool.execute(insertQuery, [
      userId,
      name,
      location,
      price,
      availability,
      gender,
      phone,
      description,
    ]);

    res.redirect("/landlord/add_hostel")
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).send('Server error');
  }
});

// Logout route

app.get("/logout", (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Error logging out");
    }
    // Redirect to the login page or any other desired page after logout
    res.redirect("/");
  });
});

app.listen(port, () => {
  console.log(`Server Started on port ${port}`);
});
