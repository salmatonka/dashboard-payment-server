const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ycofkd3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// console.log(uri)
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        const serviceCollection = client.db('dashboardCollection').collection('usedServices');
        // const bookingCollection = client.db('dashboardCollection').collection('booking');
        const usersCollection = client.db('dashboardCollection').collection('users');
        const cartCollection = client.db('dashboardCollection').collection('carts');
        const paymentCollection = client.db("dashboardCollection").collection("payments");


        //jwt  

        app.post('/jwt', (req, res) => {
            const user = req.body;
            // console.log(user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30d' })
            res.send({ token })

        })

      // middlewares 
    const verifyToken = (req, res, next) => {
        console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
            return res.status(401).send({ message: 'unauthorized access' });
          }
          const token = req.headers.authorization.split(' ')[1];
          jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
              return res.status(401).send({ message: 'unauthorized access' })
            }
            req.decoded = decoded;
            next();
          })
        
      }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }



        //users related api

        app.post('/users', async (req, res) => {
            const user = req.body;
            
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });


        app.get('/users/admin/:email',verifyToken, verifyAdmin,  async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })


        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            // console.log(result)
            res.send(result);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })


        app.delete('/users/:id',verifyToken, verifyAdmin,  async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })




        app.get('/usedServices', async (req, res) => {
            const query = {}
            const result = await serviceCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/usedServices', verifyToken, verifyAdmin,  async (req, res) => {
            const item = req.body
            const result = await serviceCollection.insertOne(item)
            res.send(result)
        })


        app.put('/usedServices', async (req, res) => {
            const id = req.query.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    report: true
                }
            }
            const result = await serviceCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        });


        app.patch('/usedServices/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    rating: item.rating,
                    description: item.description,
                    img: item.img
                }
            }

            const result = await serviceCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        app.delete('/usedServices/:id',verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollection.deleteOne(query);
            res.send(result);
        })


        //clicking or find by category
        app.get('/usedServices/:categorey', async (req, res) => {
            const categorey = req.params.categorey;
            const query = { categorey: (categorey) }
            const result = await serviceCollection.find(query).toArray()
            res.send(result)
        })

        //clicking or find by id

        app.get('/service/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollection.findOne(query)
            res.send(result)
        })



        // post  cartItem
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        });

        // carts collection
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        // app.get('/category', async (req, res) => {
        //     const query = {};
        //     const result = await categoryCollection.find(query).toArray();
        //     res.send(result)
        // })


        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
            // console.log(result)
        })
        //clicking or find by category
        // app.get("/service/:category", async (req, res) => {
        //     const category = req.params.category;
        //     // console.log(category)
        //     const query = { category: category };
        //     const result = await serviceCollection.findOne(query);
        //     res.send(result);
        //     // console.log(result)
        // });

        app.get('/singleService/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.findOne(query);
            res.send(result);
            // console.log(result)
        })

        //clicking or find by category
        // app.get('/category/:category',async(req,res)=>{
        //     const category = req.params.category;
        //     console.log(category)
        //     const query = { category: category }
        //     console.log(query)
        //     const result = await serviceCollection.findOne(query).toArray()
        //     res.send(result)
        //     console.log(result)
        // })
        //order api

        
        //services review
        app.get('/services', async (req, res) => {
            const query = {};
            const users = await photoCollection.find(query).toArray();
            res.send(users);
        })


        app.post('/services', async (req, res) => {
            const query = req.body;
            console.log(query);
            const result = await photoCollection.insertOne(query);
            res.send(result);
        })


// payment intent
app.post('/create-payment-intent', async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, 'amount inside the intent')

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  });


  app.get('/payments/:email',verifyToken,  async (req, res) => {
    const query = { email: req.params.email }
    if (req.params.email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const result = await paymentCollection.find(query).toArray();
    res.send(result);
  })

  app.post('/payments', async (req, res) => {
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);

    //  carefully delete each item from the cart
    console.log('payment info', payment);
    const query = {
      _id: {
        $in: payment.cartIds.map(id => new ObjectId(id))
      }
    };

    const deleteResult = await cartCollection.deleteMany(query);

    res.send({ paymentResult, deleteResult });
  })






    }
    finally {

    }
}
run().catch(err => console.error(err))


app.get('/', (req, res) => {
    res.send('hello photographer');

})

app.listen(port, () => {
    console.log(`hello photographer server : ${port}`)
})