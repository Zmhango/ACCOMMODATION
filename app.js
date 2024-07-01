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
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const nodemailer = require("nodemailer");

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
app.use("/images", express.static(path.join(__dirname, "images")));
const port = process.env.PORT || 8000;

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

    // Fetch all users by username
    const [results] = await pool.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    let authenticatedUser = null;
    for (const user of results) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        authenticatedUser = user;
        break;
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check if the authenticated user is active
    if (!authenticatedUser.isActive) {
      return res.status(403).json({
        message:
          "Your account has been disabled. Please contact the administrator.",
      });
    }

    // Save session details
    req.session.userId = authenticatedUser.userId;
    req.session.username = authenticatedUser.username;
    req.session.landlordId = authenticatedUser.landlordId;

    req.session.save((err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error saving session" });
      } else {
        let redirectURL = "/";
        if (authenticatedUser.role === "tenant") {
          redirectURL = "/tenant";
        } else if (authenticatedUser.role === "landlord") {
          redirectURL = "/landlord";
        } else if (authenticatedUser.role === "admin") {
          redirectURL = "/admin";
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

// INDEX ROUTE
app.get("/", async (req, res) => {
  try {
    const hostels = await pool.query(`
      SELECT hostels.hostelId, hostels.userId, hostels.name, hostels.location, hostels.price, hostels.availability, hostels.gender, hostels.email, hostels.phone, hostels.description, hostels.images
      FROM hostels
      LEFT JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status IS NULL
    `);

    // Ensure you're getting the array of objects for hostels
    const hostelData =
      Array.isArray(hostels) && hostels.length > 0 ? hostels[0] : [];

    const userIsAuthenticated = req.session.userId ? true : false;

    res.render("index", { hostels: hostelData, userIsAuthenticated });
  } catch (err) {
    console.error("Error fetching hostels:", err);
    res.status(500).send("Server Error");
  }
});

// TENANT ROUTE

// TENANT ROUTE
app.get("/tenant", async (req, res) => {
  try {
    const hostels = await pool.query(`
      SELECT hostels.hostelId, hostels.userId, hostels.name, hostels.location, hostels.price, hostels.availability, hostels.gender, hostels.email, hostels.phone, hostels.description, hostels.images
      FROM hostels
      LEFT JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status IS NULL
    `);

    const userIsAuthenticated = req.session.userId ? true : false;

    // Ensure you're getting the array of objects for hostels
    const hostelData =
      Array.isArray(hostels) && hostels.length > 0 ? hostels[0] : [];

    res.render("tenant", { hostels: hostelData, userIsAuthenticated });
  } catch (err) {
    console.error("Error fetching hostels:", err);
    res.status(500).send("Server Error");
  }
});

app.get("/about", (req, res) => {
  res.render("about");
});

// Route to handle replying to a query and updating database
app.post(
  "/admin/help_desk/reply",
  upload.single("attachment"),
  async (req, res) => {
    try {
      const recipientEmail = req.body.recipientEmail;
      const originalSubject = req.body.originalSubject;
      const replyMessage = req.body.replyMessage;
      const attachment = req.file; // Access the uploaded file details

      // Closing message
      const closingMessage = "\nRegards,\nSupport Team,\nEasyHouse";

      // Nodemailer setup (update with your email configuration)
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "zondiwemhango215@gmail.com",
          pass: "bgff ruzn lpch pijp",
        },
      });

      // Email options
      const mailOptions = {
        from: "zondiwemhango215@gmail.com",
        to: recipientEmail,
        subject: originalSubject, // Use the original subject
        text: `${replyMessage}\n${closingMessage}`, // Add the closing message
        attachments: attachment ? [{ path: attachment.path }] : [], // Attach the file if provided
      };

      // Send the reply email
      await transporter.sendMail(mailOptions);

      // Update the corresponding row in the database to mark it as replied
      await pool.query("UPDATE help_desk SET replied = TRUE WHERE email = ?", [
        recipientEmail,
      ]);

      // Redirect back to the help_desk page after sending the reply
      res.redirect("/admin/help_desk");
    } catch (error) {
      console.error("Error replying to query:", error);
      res.status(500).send("Error replying to query");
    }
  }
);

// Route to fetch unreplied queries and render help_desk view
app.get("/admin/help_desk", async (req, res) => {
  try {
    // Fetch unreplied queries from the database
    const [unrepliedQueries] = await pool.query(
      "SELECT * FROM help_desk WHERE replied = FALSE"
    );

    // Render the help_desk view and pass the unrepliedQueries data
    res.render("help_desk", { helpDeskMessages: unrepliedQueries });
  } catch (error) {
    console.error("Error fetching unreplied queries:", error);
    res.status(500).send("Error fetching unreplied queries");
  }
});

// Route to fetch replied queries and render replied_queries view
app.get("/admin/replied_queries", async (req, res) => {
  try {
    // Fetch replied queries from the database
    const [repliedQueries] = await pool.query(
      "SELECT * FROM help_desk WHERE replied = TRUE"
    );

    // Render the replied_queries view and pass the repliedQueries data
    res.render("replied_queries", { repliedQueries });
  } catch (error) {
    console.error("Error fetching replied queries:", error);
    res.status(500).send("Error fetching replied queries");
  }
});

// Handle GET request for the thank you page
app.get("/thankyou", (req, res) => {
  res.render("thankyou");
});

// Route to render the contact form
app.get("/contact", (req, res) => {
  res.render("contact");
});

// Assuming you have a route for handling contact form submissions
app.post("/contact", async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const subject = req.body.subject;
    const message = req.body.message;

    // Insert data into the 'help_desk' table
    const result = await pool.query(
      "INSERT INTO help_desk (full_name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name, email, subject, message]
    );

    // Notify admin via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "zondiwemhango215@gmail.com",
        pass: "bgff ruzn lpch pijp",
      },
    });

    const mailOptions = {
      from: email,
      to: "zondiwemhango215@gmail.com", // replace with your admin email
      subject: `New Query Submission - ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    };

    await transporter.sendMail(mailOptions);

    // Optionally, you can send a confirmation email to the user

    res.redirect("/thankyou"); // Redirect to the thank you page
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).send("Error submitting contact form");
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/landlord", async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(403).send("Unauthorized");
    }

    // Query to fetch hostels for the logged-in landlord that are not booked
    const query = `
      SELECT hostels.hostelId, hostels.userId, hostels.name, hostels.location, hostels.price, hostels.availability, hostels.gender, hostels.email, hostels.phone, hostels.description, hostels.images
      FROM hostels
      LEFT JOIN bookings ON hostels.hostelId = bookings.hostelId AND bookings.status = 'booked'
      WHERE hostels.userId = ? AND bookings.hostelId IS NULL
    `;

    const [hostels] = await pool.query(query, [userId]);

    // Calculate the number of active listings
    const activeListings = hostels.length;

    // Query to fetch the count of pending bookings for the specific landlord
    const [pendingBookingsCountData] = await pool.query(
      `
      SELECT COUNT(DISTINCT hostels.hostelId) AS pendingBookingsCount
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status = 'pending' AND hostels.userId = ?
    `,
      [userId]
    );

    const pendingBookingsCount =
      pendingBookingsCountData[0].pendingBookingsCount || 0;

    // Query to fetch the total number of bookings for the specific landlord
    const [totalBookingsCountData] = await pool.query(
      `
      SELECT COUNT(*) AS totalBookingsCount
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE hostels.userId = ?
    `,
      [userId]
    );

    const totalBookingsCount =
      totalBookingsCountData[0].totalBookingsCount || 0;

    // Render the My Listings page and pass the hostels data, active listings count, pending bookings count, and total bookings count
    res.render("landlord", {
      hostels,
      activeListings,
      pendingBookingsCount,
      totalBookingsCount,
    });
  } catch (error) {
    console.error("Error fetching landlord's data:", error);
    res.status(500).send("Server Error");
  }
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

app.get("/landlord/edit_hostel/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    const userId = req.session.userId;

    // Ensure the user is authenticated and owns the hostel
    if (!userId) {
      return res.status(403).send("Unauthorized");
    }

    const [hostelDetails] = await pool.query(
      "SELECT * FROM hostels WHERE hostelId = ? AND userId = ?",
      [hostelId, userId]
    );

    if (hostelDetails.length === 0) {
      return res
        .status(404)
        .send(
          "Hostel not found or you do not have permission to edit this hostel"
        );
    }

    const hostel = hostelDetails[0];
    res.render("edit_hostel", { hostel });
  } catch (error) {
    console.error("Error fetching hostel details:", error);
    res.status(500).send("Server Error");
  }
});

app.post(
  "/landlord/edit_hostel/:hostelId",
  upload.single("image"),
  async (req, res) => {
    try {
      const hostelId = req.params.hostelId;
      const userId = req.session.userId;
      const {
        name,
        location,
        price,
        availability,
        gender,
        email,
        phone,
        description,
      } = req.body;

      if (!userId) {
        return res.status(403).send("Unauthorized");
      }

      const image = req.file;
      const imageFilename = image ? image.filename : null;

      const updateFields = {
        name,
        location,
        price,
        availability,
        gender,
        email,
        phone,
        description,
      };

      if (imageFilename) {
        updateFields.images = imageFilename;
      }

      const fields = Object.keys(updateFields)
        .map((field) => `${field} = ?`)
        .join(", ");
      const values = Object.values(updateFields);

      const updateQuery = `UPDATE hostels SET ${fields} WHERE hostelId = ? AND userId = ?`;

      await pool.execute(updateQuery, [...values, hostelId, userId]);

      res.redirect("/landlord");
    } catch (error) {
      console.error("Error updating hostel details:", error);
      res.status(500).send("Server Error");
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

// Route to display all agents
app.get("/agent", async (req, res) => {
  try {
    const [agents] = await pool.query("SELECT * FROM agents");
    agents.forEach((agent) => {});
    res.render("agent", { agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/landlord/agent-landlord", async (req, res) => {
  try {
    const [agents] = await pool.query("SELECT * FROM agents");
    agents.forEach((agent) => {});
    res.render("agent-landlord", { agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/admin/add_agent", (req, res) => {
  res.render("add_agent");
});

app.post(
  "/admin/add_agent",
  upload.single("profile_photo"),
  async (req, res) => {
    try {
      const { first_name, surname, phone_number, email_address } = req.body;
      const userId = req.session.userId;

      if (!userId) {
        console.error("User ID not found");
        return res.status(403).send("Unauthorized");
      }

      const profilePhoto = req.file;
      const profilePhotoFilename = profilePhoto
        ? profilePhoto.filename
        : "/images/profile2.png"; // Use the placeholder image if no file is uploaded

      if (!first_name || !surname || !phone_number || !email_address) {
        console.error("Some form data is missing or undefined");
        return res
          .status(400)
          .render("add_agent", { error: "Incomplete form data" });
      }

      const insertQuery = `INSERT INTO agents (profile_photo, first_name, surname, phone_number, email_address) VALUES (?, ?, ?, ?, ?)`;

      const [results, fields] = await pool.execute(insertQuery, [
        profilePhotoFilename,
        first_name,
        surname,
        phone_number,
        email_address,
      ]);

      return res.redirect("/admin/add_agent");
    } catch (error) {
      console.error("An error occurred:", error);
      return res.status(500).render("add_agent", { error: "Server error" });
    }
  }
);

// Fetch agent details for editing
app.get("/admin/edit_agent/:agentId", async (req, res) => {
  try {
    const agentId = req.params.agentId;

    // Fetch agent details from the database
    const [agentDetails] = await pool.query(
      "SELECT * FROM agents WHERE id = ?",
      [agentId]
    );

    if (agentDetails.length === 0) {
      return res.status(404).send("Agent not found");
    }

    const agent = agentDetails[0];
    res.render("edit_agent", { agent });
  } catch (error) {
    console.error("Error fetching agent details:", error);
    res.status(500).send("Server Error");
  }
});

// Update agent details including profile picture
app.post(
  "/admin/edit_agent/:agentId",
  upload.single("profile_photo"),
  async (req, res) => {
    try {
      const agentId = req.params.agentId;
      const { first_name, surname, email_address, phone_number } = req.body;

      // Handle uploaded image
      const profilePhoto = req.file;
      const profilePhotoFilename = profilePhoto ? profilePhoto.filename : null;

      // Update fields based on form submission
      const updateFields = {
        first_name,
        surname,
        email_address,
        phone_number,
        // Add more fields as needed
      };

      // Include profile picture update if provided
      if (profilePhotoFilename) {
        updateFields.profile_photo = profilePhotoFilename; // Update to 'profile_photo'
      }

      // Construct the update query
      const fields = Object.keys(updateFields)
        .map((field) => `${field} = ?`)
        .join(", ");
      const values = Object.values(updateFields);

      const updateQuery = `UPDATE agents SET ${fields} WHERE id = ?`;

      // Execute the update query
      await pool.execute(updateQuery, [...values, agentId]);

      res.redirect("/admin"); // Redirect to admin panel or relevant page
    } catch (error) {
      console.error("Error updating agent details:", error);
      res.status(500).send("Server Error");
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

    res.redirect("/admin");
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
  const userIdToDelete = req.body.userId;

  try {
    // Check if the user ID exists
    if (!userIdToDelete) {
      return res.status(400).send("Invalid user ID");
    }

    // Delete records from tenants table (or other related tables) first
    await pool.query("DELETE FROM tenants WHERE userId = ?", [userIdToDelete]);

    // Delete records from landlords table (or other related tables) first
    await pool.query("DELETE FROM landlords WHERE userId = ?", [
      userIdToDelete,
    ]);

    // Delete records from hostels table (or other related tables) first
    await pool.query("DELETE FROM hostels WHERE userId = ?", [userIdToDelete]);

    // Now, delete the user from the users table
    await pool.query("DELETE FROM users WHERE userId = ?", [userIdToDelete]);

    res.redirect("/admin/delete_user");
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send("Error deleting user");
  }
});

app.get("/admin/user_management", (req, res) => {
  res.render("user_management");
});

// Route to render agent management page
app.get("/admin/agent_management", async (req, res) => {
  try {
    const [agents] = await pool.query("SELECT * FROM agents");
    res.render("agent_management", { agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).send("Server Error");
  }
});

// Fetch tenants for tenant management
app.get("/admin/tenant_management", async (req, res) => {
  try {
    const [tenants] = await pool.query(
      "SELECT * FROM users WHERE role = 'tenant'"
    );
    res.render("tenant_management", { tenants });
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).send("Server Error");
  }
});

// Edit tenant details
app.post("/admin/edit_tenant/:id", async (req, res) => {
  const tenantId = req.params.id;
  const { username, email, status } = req.body;

  try {
    await pool.query(
      "UPDATE users SET username = ?, email = ?, isActive = ? WHERE userId = ?",
      [username, email, status === "true", tenantId]
    );
    res.redirect("/admin/tenant_management");
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).send("Server Error");
  }
});

// Fetch landlords for landlord management
app.get("/admin/landlord_management", async (req, res) => {
  try {
    const [landlords] = await pool.query(
      "SELECT * FROM users WHERE role = 'landlord'"
    );
    res.render("landlord_management", { landlords });
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).send("Server Error");
  }
});

// Edit tenant details
app.post("/admin/edit_landlord/:id", async (req, res) => {
  const landlordId = req.params.id;
  const { username, email, status } = req.body;

  try {
    await pool.query(
      "UPDATE users SET username = ?, email = ?, isActive = ? WHERE userId = ?",
      [username, email, status === "true", landlordId]
    );
    res.redirect("/admin/landlord_management");
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).send("Server Error");
  }
});

// Example DELETE route for deleting agents
app.delete("/admin/delete_agent/:id", async (req, res) => {
  const agentId = req.params.id;
  try {
    // Replace with your DELETE query logic
    const result = await pool.query("DELETE FROM agents WHERE id = ?", [
      agentId,
    ]);
    res.json({ success: true, message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({ success: false, message: "Failed to delete agent" });
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

app.post("/landlord/add_hostel", upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      location,
      price,
      availability,
      gender,
      email,
      phone,
      description,
    } = req.body;

    const userId = req.session.userId;
    if (!userId) {
      console.error("User ID not found");
      return res.status(403).send("Unauthorized");
    }

    const image = req.file;
    const imageFilename = image ? image.filename : "";

    if (
      !name ||
      !location ||
      !price ||
      !availability ||
      !gender ||
      !email ||
      !phone ||
      !imageFilename
    ) {
      console.error("Some form data is missing or undefined");
      return res
        .status(400)
        .render("add_hostel", { error: "Incomplete form data" });
    }

    const insertQuery = `INSERT INTO hostels (userId, name, location, price, availability, gender, email, phone, description, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [results, fields] = await pool.execute(insertQuery, [
      userId,
      name,
      location,
      price,
      availability,
      gender,
      email,
      phone,
      description,
      imageFilename,
    ]);

    return res.redirect("/landlord/hostel_added");
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).render("add_hostel", { error: "Server error" });
  }
});

app.get("/landlord/hostel_added", (req, res) => {
  res.render("hostel_added");
});

// DELETE_HOSTEL ROUTE
app.get("/landlord/delete_hostel", async (req, res) => {
  try {
    const userId = req.session.userId;
    const hostels = await pool.query(
      "SELECT hostelId, userId, name, location, price, availability, gender, email, phone, description, images FROM hostels WHERE userId = ?",
      [userId] // Assuming you have authentication middleware setting req.user.id
    );

    // Ensure you're getting the array of objects for hostels
    const hostelData =
      Array.isArray(hostels) && hostels.length > 0 ? hostels[0] : [];

    res.render("delete_hostel", { hostels: hostelData });
  } catch (err) {
    console.error("Error fetching hostels:", err);
    res.status(500).send("Server Error");
  }
});

// DELETE_HOSTEL ROUTE

app.delete("/delete_hostel/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;

    // Logic to delete the hostel with the provided ID from the database
    await pool.query("DELETE FROM hostels WHERE hostelId = ?", [hostelId]);

    // Redirect to a different page or send a success response
    res.send("Hostel deleted successfully");
  } catch (err) {
    console.error("Error deleting hostel:", err);
    res.status(500).send("Server Error");
  }
});

// Admin view to fetch all hostels and delete any hostel

// GET route to render admin's delete hostel page
app.get("/admin/admin_delete_hostel", async (req, res) => {
  try {
    // Fetch all hostels
    const hostels = await pool.query("SELECT * FROM hostels");

    // Render the admin_delete_hostel page and pass the hostels data
    res.render("admin_delete_hostel", { hostels: hostels[0] });
  } catch (err) {
    console.error("Error fetching hostels:", err);
    res.status(500).send("Server Error");
  }
});

// DELETE route to delete a specific hostel by ID
app.delete("/admin/admin_delete_hostel/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;

    // Logic to delete the hostel with the provided ID from the database
    await pool.query("DELETE FROM hostels WHERE hostelId = ?", [hostelId]);

    // Send a success response
    res.send("Hostel deleted successfully");
  } catch (err) {
    console.error("Error deleting hostel:", err);
    res.status(500).send("Server Error");
  }
});

// Hostel Details

app.get("/hostel_details/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    const userIsAuthenticated = req.session.userId ? true : false;

    if (!userIsAuthenticated) {
      return res.render("unauthenticated");
    }

    const [hostelDetails] = await pool.execute(
      "SELECT * FROM hostels WHERE hostelId = ?",
      [hostelId]
    );

    if (hostelDetails.length === 0) {
      return res.status(404).send("Hostel not found");
    }

    const hostel = hostelDetails[0];

    res.render("hostel_details", { hostel, userIsAuthenticated });
  } catch (error) {
    console.error("Error fetching hostel details:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/tenant/hostel_details/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    const userIsAuthenticated = req.session.userId ? true : false;

    if (!userIsAuthenticated) {
      return res.render("unauthenticated");
    }

    const [hostelDetails] = await pool.execute(
      "SELECT * FROM hostels WHERE hostelId = ?",
      [hostelId]
    );

    if (hostelDetails.length === 0) {
      return res.status(404).send("Hostel not found");
    }

    const hostel = hostelDetails[0];

    res.render("hostel_details", { hostel, userIsAuthenticated });
  } catch (error) {
    console.error("Error fetching hostel details:", error);
    res.status(500).send("Server Error");
  }
});

//
//
//
//
//
//
//
//
// Handle POST request from booking_form.ejs
app.post("/confirm_booking/:hostelId", async (req, res) => {
  try {
    const { checkInDate, phone } = req.body;
    const hostelId = req.params.hostelId; // Retrieve hostelId from URL parameters
    const userId = req.session.userId;

    // Insert the booking into the database
    const result = await pool.query(
      "INSERT INTO bookings (hostelId, userId, checkInDate, phone) VALUES (?, ?, ?, ?)",
      [hostelId, userId, checkInDate, phone]
    );

    // Fetch hostel details
    const [hostelDetails] = await pool.query(
      "SELECT name, location, userId FROM hostels WHERE hostelId = ?",
      [hostelId]
    );

    // Check if hostelDetails is not undefined
    if (hostelDetails && hostelDetails.length > 0) {
      const { name, location, userId: landlordUserId } = hostelDetails[0];

      // Fetch user email
      const [user] = await pool.query(
        "SELECT email FROM users WHERE userId = ?",
        [userId]
      );
      const userEmail = user[0].email;

      // Fetch landlord email
      const [landlord] = await pool.query(
        "SELECT email FROM users WHERE userId = ?",
        [landlordUserId]
      );

      // Check if emails exist
      if (userEmail && landlord[0].email) {
        const landlordEmail = landlord[0].email;

        // Configure tenant transporter
        const tenantTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.TENANT_EMAIL_USER,
            pass: process.env.TENANT_EMAIL_PASS,
          },
        });

        // Configure landlord transporter
        const landlordTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.LANDLORD_EMAIL_USER,
            pass: process.env.LANDLORD_EMAIL_PASS,
          },
        });

        // Create tenant email options
        const tenantMailOptions = {
          from: process.env.TENANT_EMAIL_USER,
          to: userEmail,
          subject: "Booking Confirmation",
          text: `Dear Tenant, you have successfully booked ${name} located at ${location}.`,
        };

        // Create landlord email options
        const confirmBookingLink = `http://your-website.com/login`; // Update with your actual login URL
        const landlordMailOptions = {
          from: process.env.LANDLORD_EMAIL_USER,
          to: landlordEmail,
          subject: "New Booking",
          html: `
    <p>Dear Landlord, your hostel ${name} located at ${location} has been booked.</p>
    <p>Please confirm the booking by logging in:</p>
    <div class="button-container center-button">
      <a href="${confirmBookingLink}" style="display: inline-block; background-color: #007BFF; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Booking</a>
    </div>
  `,
        };

        // Send emails
        await tenantTransporter.sendMail(tenantMailOptions);
        await landlordTransporter.sendMail(landlordMailOptions);
      } else {
        console.log("Emails do not exist. Skipping email sending.");
      }
    } else {
      console.error("Error fetching hostel details");
      res.status(500).send("Server Error");
      return;
    }

    // Redirect to the tenant's Pending Approval page
    res.redirect("/tenant/pending_approval");
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).send("Server Error");
  }
});

// Handle POST request for cancelling a booking
app.post("/cancel_booking/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;
    const userId = req.session.userId;

    // Delete the booking from the database
    await pool.query("DELETE FROM bookings WHERE hostelId = ? AND userId = ?", [
      hostelId,
      userId,
    ]);

    // Redirect to the tenant's Pending Approval page
    res.redirect("/tenant/pending_approval");
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/tenant/pending_approval", async (req, res) => {
  try {
    const userId = req.session.userId;

    // Fetch distinct hostels with pending bookings for the specific user
    const [pendingBookingsData] = await pool.query(
      `
      SELECT DISTINCT hostels.hostelId, hostels.name, hostels.location, hostels.price, hostels.images, bookings.status
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status = 'pending' AND bookings.userId = ?
    `,
      [userId]
    );

    // Render the pending_approval page with the list of pending bookings
    res.render("pending_approval", { pendingBookings: pendingBookingsData });
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/booking_form/:hostelId", (req, res) => {
  const hostelId = req.params.hostelId;
  const userId = req.session.userId;
  res.render("booking_form", { hostelId, userId });
});

app.get("/tenant/pending_approval", async (req, res) => {
  try {
    const userId = req.session.userId;

    // Fetch distinct hostels with pending bookings for the specific user
    const [pendingBookingsData] = await pool.query(
      `
      SELECT DISTINCT hostels.hostelId, hostels.name, hostels.location, hostels.price, hostels.images, bookings.status
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status = 'pending' AND bookings.userId = ?
    `,
      [userId]
    );

    console.log("Pending Bookings for Tenant:", pendingBookingsData);

    // Render the pending_approval page with the list of pending bookings
    res.render("pending_approval", { pendingBookings: pendingBookingsData });
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/landlord/confirm_booking_landlord", async (req, res) => {
  try {
    const userId = req.session.userId;

    // Fetch hostels with pending bookings for the specific landlord
    const [pendingBookingsData] = await pool.query(
      `
      SELECT DISTINCT hostels.hostelId, hostels.name, hostels.location, hostels.price, bookings.phone, hostels.images, bookings.status
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status = 'pending' AND hostels.userId = ?
    `,
      [userId]
    );

    // Render the confirm_booking_landlord page with the list of pending bookings
    res.render("confirm_booking_landlord", {
      pendingBookings: pendingBookingsData,
    });
  } catch (error) {
    console.error("Error fetching pending bookings for landlord:", error);
    res.status(500).send("Server Error");
  }
});

// Update booked hostel status to booked

app.post("/confirm_booking_landlord/:hostelId", async (req, res) => {
  try {
    const hostelId = req.params.hostelId;

    // Update the status of the booking to 'booked'
    await pool.query(
      "UPDATE bookings SET status = 'booked' WHERE hostelId = ?",
      [hostelId]
    );

    // Redirect to tenant_bookings page
    res.redirect("/landlord/confirm_booking_landlord");
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).send("Error confirming booking");
  }
});

// Route to render tenant_bookings.ejs
app.get("/tenant_bookings", async (req, res) => {
  try {
    const userId = req.session.userId;

    // Fetch confirmed hostels for the specific user
    const [bookedHostelsData] = await pool.query(
      `
      SELECT DISTINCT hostels.hostelId, hostels.name, hostels.location, hostels.price, hostels.images
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status = 'booked' AND bookings.userId = ?
    `,
      [userId]
    );

    // Render the tenant_bookings page with the list of confirmed bookings
    res.render("tenant_bookings", { bookedHostels: bookedHostelsData });
  } catch (error) {
    console.error("Error fetching confirmed bookings:", error);
    res.status(500).send("Server Error");
  }
});

// Define a route for landlord_booking_history
app.get("/landlord/booking_history", async (req, res) => {
  try {
    const userId = req.session.userId;

    // Fetch confirmed hostels for the specific landlord
    const [confirmedHostelsData] = await pool.query(
      `
      SELECT hostels.name, hostels.location, hostels.price, hostels.phone, hostels.images
      FROM hostels
      INNER JOIN bookings ON hostels.hostelId = bookings.hostelId
      WHERE bookings.status = 'booked' AND hostels.userId = ?
    `,
      [userId]
    );

    // Render the landlord_booking_history page with the list of confirmed bookings
    res.render("landlord_booking_history", {
      confirmedHostels: confirmedHostelsData,
    });
  } catch (error) {
    console.error("Error fetching confirmed bookings for landlord:", error);
    res.status(500).send("Server Error");
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
