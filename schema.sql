-- USERS TABLE --

CREATE TABLE users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT "tenant"
);

-- TENANTS TABLE --

CREATE TABLE tenants (
    tenantId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    fname VARCHAR(50),
    lname VARCHAR(50),
    gender VARCHAR(10),
    phone VARCHAR(20),
    university VARCHAR(100),
    FOREIGN KEY (userId) REFERENCES users(userId)
);

-- LANDLORDS TABLE --

CREATE TABLE landlords (
    landlordId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    fname VARCHAR(50),
    lname VARCHAR(50),
    phone VARCHAR(20),
    FOREIGN KEY (userId) REFERENCES users(userId)
);

-- HOSTELS TABLE --

CREATE TABLE hostels (
    hostelId INT PRIMARY KEY AUTO_INCREMENT,
    userId INT,
    name VARCHAR(255),
    location VARCHAR(255),
    price DECIMAL(10, 2),
    availability VARCHAR(100),
    gender ENUM('male', 'female', 'mixed', 'Family'),
    email VARCHAR (100),
    phone VARCHAR (15),
    description TEXT,
    images TEXT,
    FOREIGN KEY (userId) REFERENCES users(userId)
);


-- BOOKINGS TABLE --

CREATE TABLE bookings (
    bookingId INT AUTO_INCREMENT PRIMARY KEY,
    hostelId INT NOT NULL,
    userId INT NOT NULL,
    booking_date DATE,
    checkInDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phone VARCHAR(15),
    status VARCHAR(20) DEFAULT 'pending', -- New column for status
    FOREIGN KEY (hostelId) REFERENCES hostels(hostelId),
    FOREIGN KEY (userId) REFERENCES users(userId)
);


can you please change the where clause WHERE bookings.booking_date IS NULL;  -- Assuming booking_date is null for pending approval. this is my table schema for bookings(CREATE TABLE bookings (
    bookingId INT AUTO_INCREMENT PRIMARY KEY,
    hostelId INT NOT NULL,
    userId INT NOT NULL,
    booking_date DATE,
    checkInDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phone VARCHAR(15),
    FOREIGN KEY (hostelId) REFERENCES hostels(hostelId),
    FOREIGN KEY (userId) REFERENCES users(userId)
);). 

 
-- FEEDBACK TABLE --

CREATE TABLE feedbacks (
    feedbackId INT AUTO_INCREMENT PRIMARY KEY,
    bookingId INT NOT NULL,
    tenantId INT NOT NULL,
    rating INT,
    comment TEXT,
    Time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bookingId) REFERENCES bookings(bookingId),
    FOREIGN KEY (tenantId) REFERENCES users(userId)
);

