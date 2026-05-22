const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config()

const uri = process.env.MONGODB_URI;

const app = express()
const PORT = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db('pawnest')
        const petCollection = db.collection('pets')
        // ফিক্স ১: কালেকশনটি এখানে ডিক্লেয়ার করা হলো
        const adoptionCollection = db.collection('adoptionRequests')

        // ১. সব পেটস পাওয়ার API
        app.get('/pet', async (req, res) => {
            try {
                const { search, species, sort } = req.query;
                const query = {};

                if (search) {
                    query.petName = {
                        $regex: search,
                        $options: 'i',
                    };
                }

                if (species) {
                    const speciesArray = species.split(',').map((s) => s.trim());
                    query.species = { $in: speciesArray };
                }

                let sortObj = {};
                if (sort === 'low-to-high') {
                    sortObj.adoptionFee = 1;
                } else if (sort === 'high-to-low') {
                    sortObj.adoptionFee = -1;
                }

                const result = await petCollection.find(query).sort(sortObj).toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching pets:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ২. সিঙ্গেল পেটের ডিটেইলস পাওয়ার API
        app.get('/pet/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // আইডি যদি ২৪ অক্ষরের হেক্স না হয়, তবে সরাসরি মঙ্গোডিবির ObjectId অবজেক্টে পাস করলে ক্র্যাশ করবে, তাই চেক করে নেওয়া নিরাপদ
                let query = { _id: id };
                if (ObjectId.isValid(id)) {
                    query = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
                }

                const result = await petCollection.findOne(query);

                if (!result) {
                    return res.status(404).json({ message: 'Pet not found' });
                }

                res.json(result);
            } catch (error) {
                console.error('Error fetching pet details:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ৩. অ্যাডপশন রিকোয়েস্ট সাবমিট করার API (সুরক্ষিত ট্রাই-ক্যাচ সহ)
        app.post('/adoption-request', async (req, res) => {
            try {
                const requestData = req.body;

                if (!requestData.petId || !requestData.userEmail) {
                    return res.status(400).json({ message: "Missing petId or userEmail" });
                }

                // চেক করুন অলরেডি রিকোয়েস্ট আছে কিনা
                const existingRequest = await adoptionCollection.findOne({
                    petId: requestData.petId,
                    userEmail: requestData.userEmail
                });

                if (existingRequest) {
                    return res.status(400).json({
                        alreadyAdopted: true,
                        message: "You have already submitted an adoption request for this pet!"
                    });
                }

                const result = await adoptionCollection.insertOne(requestData);
                res.status(201).json(result);
            } catch (error) {
                console.error('Error processing adoption request:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ৪. নির্দিষ্ট ইউজারের সব অ্যাডপশন রিকোয়েস্ট পাওয়ার API (Query Parameter দিয়ে)
        app.get('/adoption-requests', async (req, res) => {
            try {
                const { email } = req.query; // এখানে req.params এর বদলে req.query হবে

                if (!email) {
                    return res.status(400).json({ message: "Email query parameter is required" });
                }

                const query = { userEmail: email };
                const result = await adoptionCollection.find(query).toArray();

                res.json(result);
            } catch (error) {
                console.error('Error fetching user requests:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (err) {
        console.error("Failed to run the server logic:", err);
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('server is running fine!')
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});









// const express = require('express')
// const dotenv = require('dotenv')
// const cors = require('cors');
// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// dotenv.config()

// const uri = process.env.MONGODB_URI;

// const app = express()
// const PORT = process.env.PORT || 5000;

// app.use(cors())
// app.use(express.json())

// const client = new MongoClient(uri, {
//     serverApi: {
//         version: ServerApiVersion.v1,
//         strict: true,
//         deprecationErrors: true,
//     }
// });

// async function run() {
//     try {
//         await client.connect();

//         const db = client.db('pawnest')
//         const petCollection = db.collection('pets')

//         app.get('/pet', async (req, res) => {
//             try {
//                 const { search, species, sort } = req.query;

//                 const query = {};

//                 if (search) {
//                     query.petName = {
//                         $regex: search,
//                         $options: 'i',
//                     };
//                 }

//                 if (species) {
//                     const speciesArray = species.split(',').map((s) => s.trim());
//                     query.species = { $in: speciesArray };
//                 }

//                 let sortObj = {};
//                 if (sort === 'low-to-high') {
//                     sortObj.adoptionFee = 1;
//                 } else if (sort === 'high-to-low') {
//                     sortObj.adoptionFee = -1;
//                 }

//                 const result = await petCollection.find(query).sort(sortObj).toArray();
//                 res.json(result);
//             } catch (error) {
//                 console.error('Error fetching pets:', error);
//                 res.status(500).json({ message: 'Internal server error' });
//             }
//         });

//         app.get('/pet/:id', async (req, res) => {
//             try {
//                 const { id } = req.params;

//                 let result = await petCollection.findOne({ _id: id });

//                 if (!result && ObjectId.isValid(id)) {
//                     result = await petCollection.findOne({ _id: new ObjectId(id) });
//                 }

//                 if (!result) {
//                     return res.status(404).json(null);
//                 }

//                 res.json(result);
//             } catch (error) {
//                 console.error('Error fetching pet details:', error);
//                 res.status(500).json({ message: 'Internal server error' });
//             }
//         });




//         await client.db("admin").command({ ping: 1 });
//         console.log("Pinged your deployment. You successfully connected to MongoDB!");
//     } finally {
//         // await client.close();
//     }
// }
// run().catch(console.dir);


// app.get('/', (req, res) => {
//     res.send('server is running fine!')
// })

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// })