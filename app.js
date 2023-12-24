const express = require('express');
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcrypt");
const dotenv = require('dotenv').config()
const saltRounds = 10; // Number of salt rounds
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
const pool = require('./db');
const crypto = require('crypto');

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

app.use(
  session({
    secret: crypto.randomBytes(64).toString('hex'), // New secret key for sessions
    resave: true,
    saveUninitialized: true,
  })
);


// Loging in 


// ...


app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [results, fields] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    req.session.userId = user.user_id;
    req.session.username = user.username;

    req.session.save((err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error saving session' });
      } else {

        let redirectURL = '/'; // Define default redirect URL
        if (user.role === 'tenant') {
          redirectURL = '/tenant';
        } else if (user.role === 'landlord') {
          redirectURL = '/landlord';
        }
        res.status(200).json({ redirect: redirectURL });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error during login' });
  }
});



app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).send('Incomplete data');
    }
    
    const hashedPassword = await hashPassword(password);
    pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )
    .then(() => {
      res.render('login');
    })
    .catch((error) => {
      console.error('Error registering user:', error);
      res.status(500).send('Error registering user');
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering user');
  }
});

app.get("/", (req,res) =>{
    const data = {
        title:"home",
        active:"home"
    }
    res.render("index", data)
})

app.get("/about", (req, res)=>{
    res.render("about")
})

app.get("/contact", (req, res)=>{
    res.render("contact")
})

app.get("/register", (req, res)=>{
    res.render("register")
})

app.get("/login", (req, res)=>{
    res.render("login")
})

app.get("/tenant", (req, res)=>{
    res.render("tenant")
})



app.get("/landlord", (req, res)=>{
    res.render("landlord")
})

app.get("/admin", (req, res) =>{
    res.render("admin")
})

app.get("/admin/add_landlord", (req, res) =>{
    res.render("add_landlord")
})


app.get("/tenant_profile", (req, res)=>{

  const data = {
    title: "tenant-Profile",
    active: "Profile",
    username: req.session.username
  }

  res.render("tenant_profile", data)
})

// Route to handle profile update

app.post('/tenant_profile', async (req, res) => {
  try {
    const { fname, lname, gender, phone, university } = req.body;
    const userId = req.session.user_id;

    // Validate and set default values for undefined fields
    const firstName = fname || null;
    const lastName = lname || null;
    const userGender = gender || null;
    const userPhone = phone || null;
    const userUniversity = university || null;

    // Check if the tenant profile exists for the user_id
    const [existingTenant] = await pool.execute(
      'SELECT * FROM tenants WHERE user_id = ?',
      [userId]
    );

    if (existingTenant.length === 0) {
      // Insert a new row into the tenants table
      await pool.execute(
        'INSERT INTO tenants (user_id, fname, lname, gender, phone, university) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, firstName, lastName, userGender, userPhone, userUniversity]
      );
    } else {
      // Update the existing row for the given user_id
      await pool.execute(
        'UPDATE tenants SET fname = ?, lname = ?, gender = ?, phone = ?, university = ? WHERE user_id = ?',
        [firstName, lastName, userGender, userPhone, userUniversity, userId]
      );
    }

    res.redirect('/tenant_profile');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating profile');
  }
});








// Adding Landlord in database
app.post('/add_landlord', async (req, res) => {
    try {
      const { username, email, password, role } = req.body;
      console.log(req.body);
  
      const hashedPassword = await hashPassword(password);
  
      if (role === 'landlord') {
        await pool.execute(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, role]
        );
      } else {
        await pool.execute(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, 'tenant']
        );
      }
  
      res.status(200).send('User registered successfully');
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).send('Error registering user');
    }
  });



app.listen(port, () =>{
    console.log(`Server Started on port ${port}`)
})