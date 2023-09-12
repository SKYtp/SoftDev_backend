var express = require('express')
var cors = require('cors')
var app = express()
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
const bcrypt = require('bcrypt');
const saltRounds = 10;
var jwt = require('jsonwebtoken');
const secret = 'Software_Dev';
const mysql = require('mysql2');
const multer = require('multer');
const storage = multer.memoryStorage(); // Store image in memory
const upload = multer({ storage });
const fs = require('fs'); // Import the fs module

app.use(cors())

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'softdev'
});

app.get('/' , (req , res)=>{
   res.send('hello from server')
})

app.post('/',jsonParser,function(req,res,next){

})

app.post('/register', jsonParser, function(req, res, next) {
    const email = req.body.email;

    // Check if email already exists
    connection.execute(
        'SELECT email FROM users WHERE email = ?',
        [email],
        function(err, results, fields) {
            if (err) {
                res.json({ status: 'error', message: err });
                return;
            }

            if (results.length > 0) {
                // Email is already taken
                res.json({ status: 'error', message: 'Email is already taken' });
                return;
            }

            // If email is not taken, proceed with registration
            bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
                connection.execute(
                    'INSERT INTO users (email, user_name, con_num, first_name, last_name, password) VALUES (?, ?, ?, ?, ?, ?)',
                    [email, req.body.user_name, req.body.con_num, req.body.first_name, req.body.last_name, hash],
                    function(err, results, fields) {
                        if (err) {
                            res.json({ status: 'error', message: err });
                            return;
                        }
                        res.json({ status: 'ok' });
                    }
                );
            });
        }
    );
});


app.post('/login',jsonParser,function(req,res,next){
    connection.execute(
        'SELECT * FROM users WHERE email =?',
        [req.body.email],
        function(err,users,fields){
            if(err){res.json({status:'error', message: err}); return}
            if(users.length == 0){res.json({status: 'error',message: 'no user found'}); return}
            bcrypt.compare(req.body.password, users[0].password, function(err, isLogin) {
                if(isLogin){
                var token = jwt.sign({ email: users[0].email }, secret, { expiresIn: '1h' });
                res.json({status: 'ok', message: 'login success',token})
                }
                else{
                res.json({status: 'error', message: 'login failed'})
                }

            });
        }
    )
})

const uploadPath = './uploads/order/image'; 

// Ensure that the directory exists, create it if it doesn't
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

app.post('/order', upload.single('image'), function (req, res) {
    // Extract the file type (extension) from the uploaded image filename
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();

    // Generate a unique filename for the image based on timestamp
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}.${fileExtension}`;

    // Construct the image path on the server
    const imagePath = `${uploadPath}/${uniqueFilename}`;

    // Store the image on the server
    fs.writeFile(imagePath, req.file.buffer, (err) => {
        if (err) {
            console.error('Error storing the image:', err);
            res.json({ status: 'error', message: 'Error storing the image.' });
            return;
        }
        console.log('Image stored successfully:', imagePath);

        // Store the image path in the database
        connection.execute(
            'INSERT INTO orders (order_name, skin_num, rank, win_rate, gold, diamond, marble, coupon, price, hero_num, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                req.body.order_name,
                req.body.skin_num,
                req.body.rank,
                req.body.win_rate,
                req.body.gold,
                req.body.diamond,
                req.body.marble,
                req.body.coupon,
                req.body.price,
                req.body.hero_num,
                imagePath, // Store the image path on the server
            ],
            function (err, results, fields) {
                if (err) {
                    console.error('Error inserting data into database:', err);
                    res.json({ status: 'error', message: err });
                    return;
                }
                console.log('Order inserted successfully.');
                res.json({ status: 'ok' });
            }
        );
    });
});


app.get('/orders', function (req, res) {
    console.log('Fetching orders...');

    // Define the SQL query template
    let query = 'SELECT * FROM orders';

    query += ` WHERE order_name <> ""`;

    // Check for query parameters and construct the SQL query accordingly
    // if (req.query.filter) {
    //     const filter = req.query.filter;
    //     query += ` WHERE order_name LIKE '%${filter}%' OR rank LIKE '%${filter}%'`;
    // }

    if (req.query.skinNumGreaterThan) {
        const skinNumGreaterThan = parseInt(req.query.skinNumGreaterThan);
        //isNaN check if not number ex. 12 = false, hello = true
        if (!isNaN(skinNumGreaterThan)) {
            query += ` AND skin_num > ${skinNumGreaterThan}`;
        }
    }
    if(req.query.skinBetween){
        const skinBetween = req.query.skinBetween.split(",");
        if(!isNaN(skinBetween[0]) && !isNaN(skinBetween[1])){
            query += ` AND skin_num BETWEEN ${skinBetween[0]} AND ${skinBetween[1]}`
        }
    }
    if(req.query.heroNumGreaterThan){
        const heroNumGreaterThan = parseInt(req.query.heroNumGreaterThan);
        if(!isNaN(heroNumGreaterThan)){
            query += ` AND hero_num > ${heroNumGreaterThan}`;
        }
    }

    if(req.query.heroBetween){
        const heroBetween = req.query.heroBetween.split(",");
        if(!isNaN(heroBetween[0]) && !isNaN(heroBetween[1])){
            query += ` AND hero_num BETWEEN ${heroBetween[0]} AND ${heroBetween[1]}`
        }
    }

    if(req.query.rank){
        const rank = req.query.rank;
        query += ` AND rank = '${req.query.rank}'`
    }

    if(req.query.priceGreaterThan){
        const priceGreaterThan = parseInt(req.query.priceGreaterThan);
        if(!isNaN(priceGreaterThan)){
            query += ` AND price > ${priceGreaterThan}`;
        }
    }

    if(req.query.priceBetween){
        const priceBetween = req.query.priceBetween.split(",");
        if(!isNaN(priceBetween[0]) && !isNaN(priceBetween[1])){
            query += ` AND price BETWEEN ${priceBetween[0]} AND ${priceBetween[1]}`
        }
    }

    if (req.query.orderBy) {
        const orderBy = req.query.orderBy;
        //query += ` ORDER BY ${orderBy}`;
        if(req.query.orderBy == "ASC"){
            query += ` ORDER BY price ASC`;
        }
        else if(req.query.orderBy == "DESC"){
            query += ` ORDER BY price DESC`;
        }
    }

    connection.execute(query, function (err, results, fields) {
        if (err) {
            console.error('Error fetching orders:', err);
            res.json({ status: 'error', message: err });
            return;
        }

        // Fetch and send image data for each order
        const ordersWithImages = results.map((order) => {
            const imagePath = order.image;
            const imageData = fs.readFileSync(imagePath, 'base64'); // Read image as base64 data

            return {
                ...order,
                image: `data:image/jpeg;base64,${imageData}`, // Adjust the content type based on your image type
            };
        });

        res.json({ status: 'ok', orders: ordersWithImages });
    });
});





app.listen(3333,  function () {
    console.log('CORS-enabled web server listening on port 3333')
})
