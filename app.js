const express = require('express')
const dotenv = require('dotenv')
dotenv.config({path:'./det.env'})
const app = express()
const bcrypt = require('bcryptjs')
const mysql = require("mysql")
const PORT = process.env.PORT||5000
const jwt = require('jsonwebtoken')

// to use json data
app.use(express.json())

const minChar = 5

// Connection to database
const connect = mysql.createConnection({
    host:process.env.DATABASE_HOST,
    user:process.env.DATABASE_USER,
    password:process.env.DATABASE_PASSWORD,
    database:process.env.DATABASE_NAME
})

connect.connect((err)=>{
    if(err) throw err;
    console.log(`Database successfully connected`);
})

// Middleware
const registerValid = (req,res,next)=>{
    // console.log("RegisterValid middleware");
    // console.log(req.body.password.length);
    const {username,password,confirmPassword} = req.body

    if(username.length < minChar) return res.status(400).json({
        success:false,
        msg : `Please a enter username with minimum ${minChar}`
    })

    if(username.toLowerCase() === password.toLowerCase()) return res.status(400).json({
        success:false,
        msg:"Username and Password should not be identitcal"
    })

    if(password.length < minChar) return res.status(400).json({
        success:false,
        msg : `Please a enter password with minimum ${minChar}`
    })

    // if password doesnot match : 
    if(password != confirmPassword) return res.status(400).json({
        success:false,
        msg : `Passwords do not match`
    })

    // for executing the next function
    next()
}

const authorize =(req,res,next)=>{
    console.log(`Authorize`);
    let token = req.headers['authorization']

    // If token is not found
    if(!token) return res.status(401).json({
        success:false,
        msg : "Login Required"
    })  
    // console.log(token);

    token = token.split(' ')[1];

    // console.log(token);
    
    try{
        // console.log('try');
        // console.log(token);
        const decoded = jwt.verify(token,process.env.JWT_SECRET_KEY)
        req.loggedIn = decoded

        // executing the next function
        next();
    }catch(err){
        return res.status(401).json({
            success:false,
            msg : "Token Session Expired"
        })
    }
}

// Routes
// Route 1
app.post("/login",(req,res)=>{
    // token generation occurs using jwt sign
    connect.query(`select * from users where username = ${connect.escape(req.body.username)};`,(err,result)=>{
        if(err) return res.status(400).json({
            success:false,
            msg : err
        })
        if(!result) return res.status(401).json({
            success:false,
            msg : "Invalid Credentials"
        })
        // compare passwords
        bcrypt.compare(req.body.password,result[0]['password'],(perr,presult)=>{
            if(perr) return res.status(401).json({
                success:false,
                msg : "Invalid Credentials"
            })

            // token generation
            const token = jwt.sign({
                username:result[0].username,
                userId : result[0].id
            },process.env.JWT_SECRET_KEY,{
                expiresIn:process.env.JWT_EXPIRES_IN
            })

            return res.status(200).json({
                success:true,
                msg:"Login Successful",
                user : result[0],
                token:token
            })
        })
    })
})

// Route 2
app.post("/register",registerValid,(req,res)=>{
    console.log("Register Route");
    connect.query(`select * from users where lower(username) = lower(${req.body.username})`,(err,result)=>{
        console.log(result);
        if(result) return res.status(409).json({
            success:false,
            msg : "User already Exists!"
        })
        else{
            bcrypt.hash(req.body.password,10,(err,hash)=>{
                if(!err){
                    connect.query(`insert into users (username,password) values ('${req.body.username}',${connect.escape(hash)});`,(err,result)=>{
                        if(err) return res.status(404).json({
                            success:false,
                            err:err
                        })
                        else return res.status(200).json({
                            success:true,
                            msg : "Registered"
                        })
                    })
                }
                else return res.status(404).jsom({
                    success:false,
                    err:err
                })
            })
        }
    })
})

// Route 3
app.get("/posts",(req,res)=>{
    // First Join the table so as to get the user who uploaded the post
    // joining should happen based on user_id of posts table and id of users table
    connect.query(`select posts.title,posts.content,posts.id,users.username from users inner join posts on posts.user_id = users.id;`,(err,result)=>{
        if(err) return res.status(400).json({
            success:false,
            msg : "Not able to fetch data"
        })

        return res.status(200).json({
            success:true,
            result
        })
    })
})

// Route 4
app.get("/posts/:userId",(req,res)=>{
    const user_id = req.params.userId
    connect.query(`select id,title,content from posts where user_id = ${user_id};`,(err,result)=>{
        if(err) return res.status(400).json({
            success:false,
            msg : "No results found"
        })
        return res.status(200).json({
            success:true,
            result
        })
    })
})


// Route 5
app.post("/posts/new",authorize,(req,res)=>{
    // console.log(req.loggedIn);
    const {title,content} = req.body
    connect.query(`insert into posts (title,content,user_id) values ('${title}','${content}',${req.loggedIn.userId})`,(err,result)=>{
        if(err) return res.status(401).json({
            success:false,
            msg : err
        })
        return res.status(200).json({
            success:true,
            msg : "New Post Created"
        })
    })
})

// For testing whether backend route is working
app.get("/",(req,res)=>{
    res.send("HOME PAGE")
})

app.listen(PORT,()=>{
    console.log(`Connected to PORT : ${PORT}`)
})