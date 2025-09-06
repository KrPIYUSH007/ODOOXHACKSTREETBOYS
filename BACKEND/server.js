const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
let db;

function connectToDatabase() {
  db = mysql.createConnection({
    host: "localhost",
    user: "root", 
    password: "123456789", 
    database: "ecofinds_db",
  });
  
  db.connect((err) => {
    if (err) {
      console.error("Error connecting to the database:", err);
      return;
    }
    console.log("Connected to MySQL database.");

  
    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(255),
        user_id INT
      );
    `;
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        username VARCHAR(255),
        member_since DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    db.query(createProductsTable, (err, result) => {
      if (err) throw err;
      console.log("Products table ensured to exist.");
    });
    
    db.query(createUsersTable, (err, result) => {
      if (err) throw err;
      console.log("Users table ensured to exist.");
    });
  });
}

connectToDatabase();

app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));


const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authentication failed: No token provided." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication failed: Invalid token." });
  }
};


app.post("/api/register", (req, res) => {
  const { email, password, username } = req.body;
  
  if (!email || !password || !username) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ error: "Registration failed." });
    }
    
    const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    db.query(sql, [username, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Email already registered." });
        }
        console.error("Registration failed:", err);
        return res.status(500).json({ error: "Registration failed." });
      }
      res.status(201).json({ message: "Registration successful!" });
    });
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Login failed:", err);
      return res.status(500).json({ error: "Login failed." });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ message: "Login successful!", token });
    });
  });
});


app.get("/api/products", authMiddleware, (req, res) => {
  const { q, user_id } = req.query;
  let sql = "SELECT * FROM products";
  const params = [];

  if (user_id) {
    sql += " WHERE user_id = ?";
    params.push(user_id);
  } else if (q) {
    sql += " WHERE title LIKE ?";
    params.push(`%${q}%`);
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).json({ error: "Failed to fetch products." });
    }
    res.json(results);
  });
});

app.post("/api/products", authMiddleware, (req, res) => {
  const { title, description, category, price, image_url } = req.body;
  
  if (!title || !category || !price) {
    return res.status(400).json({ error: "Title, category, and price are required." });
  }

  
  const userId = req.user.id;
  const newProduct = { title, description, category, price, image_url, user_id: userId };
  const sql = "INSERT INTO products SET ?";
  
  db.query(sql, newProduct, (err, result) => {
    if (err) {
      console.error("Error inserting product:", err);
      return res.status(500).json({ error: "Failed to add product." });
    }
    io.emit("newProduct", newProduct);
    res.status(201).json({ message: "Product added successfully!" });
  });
});

app.get("/api/users/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;
  

  if (req.user.id.toString() !== userId) {
    return res.status(403).json({ error: "Forbidden: You can only access your own data." });
  }

  db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
    if (err) {
      console.error("Error fetching user:", err);
      return res.status(500).json({ error: "Failed to fetch user data." });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    
    const user = results[0];
    delete user.password; 
    res.json(user);
  });
});

app.put("/api/users/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;
  const { username, email } = req.body;

  if (req.user.id.toString() !== userId) {
    return res.status(403).json({ error: "Forbidden: You can only update your own data." });
  }

  const sql = "UPDATE users SET username = ?, email = ? WHERE id = ?";
  db.query(sql, [username, email, userId], (err, result) => {
    if (err) {
      console.error("Error updating user:", err);
      return res.status(500).json({ error: "Failed to update user data." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "User updated successfully!" });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
