const express = require("express");
const app = express();
const cors = require("cors");
const { foodCart, foodproduct, sequelize, foodUsers } = require("./ORM");
const jwt = require("jsonwebtoken");
const { UpdateCartService } = require("./updateCartService");
app.use(express.json());
app.use(cors());
const multer = require("multer");

const stripe = require("stripe")(
  "sk_test_51PDOVWSESsyTouXCswhna8S7rAomWfNb3CnbyU0CFB0iMo7pdZaVlbDC6utMRuVzLDC832CIZxLaCvGzh0XKwcs100KWrtHZI9"
);
app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

app.post(
  "/addProduct",
  upload.single("images"),
  async function (req, res, next) {
    await sequelize.sync();
    await foodproduct.bulkCreate(products);
    res.json({ message: "data updated" });
  }
);

app.get("/getImage", async (req, res) => {
  await sequelize.sync();
  let id = req["query"]["id"];
  let result = await foodproduct.findOne({ where: { id: `${id}` } });
  if (result.dataValues.Product_image == null) {
    res.sendFile(`uploads/no_img.jpg`, { root: __dirname });
  } else {
    res.sendFile(`uploads/${result.dataValues.Product_image}`, {
      root: __dirname,
    });
  }
});

app.get("/getProduct", async (req, res) => {
  await sequelize.sync();
  let result = await foodproduct.findAll();
  res.json({ message: result });
});

app.get("/getProductById/:id", async (req, res) => {
  await sequelize.sync();
  let result = await foodproduct.findOne({
    where: { id: req["params"]["id"] },
  });
  if (result) {
    res.status(200);
    res.json(result);
  } else {
    res.status(400);
    res.json({ Error: "No product avaliable" });
  }
});

//addCart
app.post("/addCart/:u_id/:p_id", async (req, res) => {
  let user_id = req.params.u_id;
  let product_id = req.params.p_id;
  await sequelize.sync();
  let f_product = await foodproduct.findByPk(product_id);
  let f_user = await foodUsers.findByPk(user_id);
  try {
    if (f_product) {
      if (f_user) {
        debugger;
        let f_Cart = await foodCart.create({
          p_id: product_id,
          u_id: user_id,
          p_name: f_product.dataValues.Product_name,
          quantity: f_product.dataValues.Quantity,
          total_price: f_product.dataValues.Price,
        });
        res.status(200).json(f_Cart);
      } else {
        throw "User Not found,Please Login";
      }
    } else {
      throw "Product Id Not match";
    }
  } catch (e) {
    res.status(400).json(e);
  }
});
//getCart
app.get("/getCart/:id", async (req, res) => {
  try {
    let uid = req["params"]["id"];
    let res1 = await foodCart.findAll({ where: { u_id: uid } });
    if (res1 == null) {
      throw "your cart is empty";
    } else {
      let total = await calculatePrice(uid);
      res.status(200);
      res.json({ Result: res1, status: 200, total_price: total });
    }
  } catch (e) {
    res.status(400);
    console.log(e);
    res.json({ error: e });
  }
});

//deleteCart
app.delete("/deleteCart/:id/:u_id", async (req, res) => {
  let cart_id = req.params.id;
  let u_id = req.params.u_id;
  try {
    await sequelize.sync();
    let total = await calculatePrice(u_id);
    await foodCart.destroy({
      where: {
        u_id: u_id,
        p_id:cart_id
      },
    });
    
    res.json({ message: "item removed frm cart", total_price: total });
  } catch (e) {
    console.log(e);
    res.status(400);
    res.json({ erroe: e });
  }
});

app.get('/truncate/:uid',async(req,res)=>{
  try{
    await sequelize.sync();
    await foodCart.destroy({
      where: {
        u_id: req['params']['uid'],
      },
    });
    res.json({"Message":"Sucess"})
  } catch(e){
    res.status(400).json({"Error":"Something went wrong"})
  }
})
//update cart
let service = new UpdateCartService();
// sample model of endpoint for update "http://localhost:8080/updateCart?p_id=3&qty=6&u_id=3"
app.post("/updateCart", async (req, res) => {
  try {
    let query = req["query"];
    let result = await service.updateCart(
      query["p_id"],
      query["qty"],
      query["u_id"]
    );
    let total = await calculatePrice(query["u_id"]);
    res.json({ Message: result, total_price: total });
  } catch (error) {
    res.json(error.message);
  }
});

// Login route with Sequelize
app.post("/loginAuth", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await foodUsers.findOne({ where: { email, password } });
    if (!user) {
      throw new Error("User Not available");
    }
    const token = jwt.sign({ email, password }, "shhhshhsh", {
      expiresIn: "1d",
    });
    user.token = token;
    await user.save();
    res.json({ token: user.token, id: user.user_id });
  } catch (error) {
    res.json({ Error: error.message });
  }
});

// Endpoint to create a new user
app.post("/createUser", async (req, res) => {
  const { email, password } = req.body;
  try {
    foodUsers.sync();
    // Create a new user entry in the User table
    const newUser = await foodUsers.create({ email, password });

    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Error creating user" });
  }
});

// Logout route with Sequelize
app.get("/logOut/:id", async (req, res) => {
  const id = req["params"]["id"];
  try {
    const user = await foodUsers.findByPk(id);
    if (!user) {
      throw "User not found";
    }
    user.token = null;
    await user.save();
    res.json({ message: "Token Removed" });
  } catch (error) {
    res.json({ message: error });
  }
});

async function calculatePrice(id) {
  let result = await foodCart.findAll({
    where: { u_id: id },
    attributes: ["total_price"],
  });

  if (result !== null) {
    let total = 0;

    result.map((i) => {
      total += i.dataValues.total_price;
    });
    return total;
  } else {
    throw new Error("No user is found");
  }
}

app.post("/create-checkout-session", async (req, res) => {
  const { Product } = req["body"];
  const lineItems = Product.map((product) => 
    ({
      price_data: {
        currency: "INR",
        product_data: {
          name: product.p_name,
        },
        unit_amount: product.total_price * 100,
      },
      quantity:product.quantity
    }));
  console.log(lineItems);

  const session = await stripe.checkout.sessions.create({
    line_items: lineItems,
    mode: "payment",
    success_url: `http://localhost:4200/`,
    cancel_url: `http://localhost:4200/confirmation?success=false`,
  });

  console.log(session);
  res.json({ url: session.url });
});

app.listen(8080, () => {
  console.log("server is running");
});
