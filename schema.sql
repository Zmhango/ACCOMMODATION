-- USERS TABLE --

CREATE TABLE users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT "tenant"
);

-- STUDENTS TABLE --

CREATE TABLE tenants (
    tenant_id INT AUTO_INCREMENT PRIMARY KEY,
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
    landlord_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    fname VARCHAR(50),
    lname VARCHAR(50),
    phone VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- HOSTELS TABLE --

CREATE TABLE hostels (
    hostel_id INT AUTO_INCREMENT PRIMARY KEY,
    landlord_id INT NOT NULL,
    name VARCHAR(100),
    address VARCHAR(255),
    description TEXT,
    price_per_month DECIMAL(10, 2),
    availability BOOLEAN,
    images TEXT,
    FOREIGN KEY (landlord_id) REFERENCES landlords(landlord_id)
);

-- BOOKINGS TABLE --

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    hostel_id INT NOT NULL,
    tenant_id_id INT NOT NULL,
    booking_date DATE,
    FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id),
    FOREIGN KEY (tenant_id) REFERENCES users(user_id)
);

-- FEEDBACK TABLE --

CREATE TABLE feedbacks (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    tenant_id INT NOT NULL,
    rating INT,
    comment TEXT,
    Time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (tenant_id) REFERENCES users(user_id)
);

