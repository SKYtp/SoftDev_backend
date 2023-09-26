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
            'INSERT INTO sellorder (seller_email,order_name, skin_num, rank, win_rate, gold, diamond, marble, coupon, price, hero_num, image,commission,status) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)',
            [
                req.body.seller_email,
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
                req.body.commission,
                req.body.status
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

    let query = 'SELECT * FROM sellorder';

    query += ` WHERE id=${req.query.send_id}`;

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

app.get('/showOrder',function(req,res){
    let query = 'SELECT id, image, order_name, price FROM sellorder';
    if(req.query.search){
        query += ` WHERE order_name LIKE '%${req.query.search}%'`
    }
    else{
        query += ` WHERE order_name <> ""`;
    }

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
        const rank = req.query.rank.split(",");
        query += ` AND (`;
        for(let i in rank){
            if(i == 0){
                query += `rank='${rank[i]}'`;
            }
            else{
                query += ` OR rank='${rank[i]}'`;
            }
        }
        query += `)`;
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
    connection.execute(query, function(err, results, fields){
        if (err) {
            console.error('Error fetching orders:', err);
            res.json({ status: 'error', message: err });
            return;
        }
        const ordersWithImages = results.map((order) => {
            const imagePath = order.image;
            const imageData = fs.readFileSync(imagePath, 'base64');
            return{
                ...order,
                image: `data:image/jpeg;base64,${imageData}`, // Adjust the content type based on your image type

            }
        });
        res.json({ status: 'ok', orders: ordersWithImages });
    });

});

app.get('/protected', (req, res) => {
    const token = req.headers.authorization;
  
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
  
    // Verify and decode the JWT
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
  
      // The decoded payload contains user information
      const { email } = decoded; // Change to 'email' because JWT payload contains email
  
      res.json({ message: 'Protected resource', email });
    });
});

const uploadPath_Boost_c = './uploads/boost/image_card';
const uploadPath_Boost_p = './uploads/order/image_person';
const uploadPath_Boost_f = './uploads/order/image';

if (!fs.existsSync(uploadPath_Boost_c)) {
    fs.mkdirSync(uploadPath_Boost_c, { recursive: true });
}
if (!fs.existsSync(uploadPath_Boost_p)) {
    fs.mkdirSync(uploadPath_Boost_p, { recursive: true });
}
if (!fs.existsSync(uploadPath_Boost_f)) {
    fs.mkdirSync(uploadPath_Boost_f, { recursive: true });
}

app.post('/boost', upload.fields([{ name: 'image_c' }, { name: 'image_p' }, { name: 'image_f' }]), function (req, res) {
    // Extract the file types (extensions) from the uploaded image filenames
    const fileExtension1 = req.files['image_c'][0].originalname.split('.').pop().toLowerCase();
    const fileExtension2 = req.files['image_p'][0].originalname.split('.').pop().toLowerCase();
    const fileExtension3 = req.files['image_f'][0].originalname.split('.').pop().toLowerCase();

    // Generate unique filenames for the images based on timestamps
    const timestamp = Date.now();
    const uniqueFilename1 = `${timestamp}_1.${fileExtension1}`;
    const uniqueFilename2 = `${timestamp}_2.${fileExtension2}`;
    const uniqueFilename3 = `${timestamp}_3.${fileExtension3}`;

    // Construct the image paths on the server
    const imagePath1 = `${uploadPath_Boost_c}/${uniqueFilename1}`;
    const imagePath2 = `${uploadPath_Boost_p}/${uniqueFilename2}`;
    const imagePath3 = `${uploadPath_Boost_f}/${uniqueFilename3}`;

    // Store the images on the server
    fs.writeFile(imagePath1, req.files['image_c'][0].buffer, (err1) => {
        if (err1) {
            console.error('Error storing the first image:', err1);
            res.json({ status: 'error', message: 'Error storing the first image.' });
            return;
        }
        console.log('First image stored successfully:', imagePath1);

        fs.writeFile(imagePath2, req.files['image_p'][0].buffer, (err2) => {
            if (err2) {
                console.error('Error storing the second image:', err2);
                res.json({ status: 'error', message: 'Error storing the second image.' });
                return;
            }
            console.log('Second image stored successfully:', imagePath2);

            fs.writeFile(imagePath3, req.files['image_f'][0].buffer, (err3) => {
                if (err3) {
                    console.error('Error storing the third image:', err3);
                    res.json({ status: 'error', message: 'Error storing the third image.' });
                    return;
                }
                console.log('Third image stored successfully:', imagePath3);

                // Store the image paths in the database
                connection.execute(
                    'INSERT INTO boost (name, p_email, surname, birth, email, tel, address, province, postcode, facebook, line,rank,star_price,m_rank,winrate, card_pic, pic, promote_pic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        req.body.name,
                        req.body.p_email,
                        req.body.surname,
                        req.body.birth,
                        req.body.email,
                        req.body.tel,
                        req.body.address,
                        req.body.province,
                        req.body.postcode,
                        req.body.facebook,
                        req.body.line,
                        req.body.rank,
                        req.body.star_price,
                        req.body.m_rank,
                        req.body.winrate,
                        imagePath1,
                        imagePath2,
                        imagePath3,
                    ],
                    function (err, results, fields) {
                        if (err) {
                            console.error('Error inserting data into the database:', err);
                            res.json({ status: 'error', message: err });
                            return;
                        }
                        console.log('Order inserted successfully.');
                        res.json({ status: 'ok' });
                    }
                );
            });
        });
    });
});










app.listen(3333,  function () {
    console.log('CORS-enabled web server listening on port 3333')
})
