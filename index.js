const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_SIDE_URL}/api/auth/jwks`),
);

async function validateToken(req, res, next) {
  const authHeaders = req?.headers.authorization;
  if (!authHeaders) return res.status(401).json({ message: "unauthorized" });
  const token = authHeaders?.split(" ")[1];
  console.log('bonda', token);
  try {
    const { payload } = await jwtVerify(token, JWKS)
    // console.log("payload bonda", payload);
    await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
}


async function run() {
    try {
        await client.connect();

        const db = client.db('pawnest')
        const petCollection = db.collection('pets')
        const adoptionCollection = db.collection('adoptionRequests')

        app.post('/pet', async (req, res) => {
            try {
                const newPet = req.body;
                if (!newPet.petName || !newPet.species) {
                    return res.status(400).json({ message: "Pet name and species are required!" });
                }
                const result = await petCollection.insertOne(newPet);
                res.status(201).json(result);
            } catch (error) {
                console.error('Error inserting new pet:', error);
                res.status(500).json({ message: 'Failed to add pet to database' });
            }
        });


        app.put('/pet/:id', async (req, res, next) => {
            const authHeader = req.headers.authorization;
            console.log(authHeader);
            next()
            if (!authHeader) {
                return res.status(401).json({ message: "Unauthorized: No token provided" });
            }

            try {
                const id = req.params.id;
                const updatedData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: "Invalid Pet ID" });
                }

                const query = { _id: new ObjectId(id) };

                const updateDoc = {
                    $set: {
                        petName: updatedData.petName,
                        species: updatedData.species,
                        breed: updatedData.breed,
                        age: updatedData.age,
                        gender: updatedData.gender,
                        adoptionFee: updatedData.adoptionFee,
                        imageUrl: updatedData.imageUrl,
                        healthStatus: updatedData.healthStatus,
                        location: updatedData.location,
                        description: updatedData.description
                    },
                };

                const result = await petCollection.updateOne(query, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: "Pet not found" });
                }

                res.json({ message: "Pet updated successfully", result });
            } catch (error) {
                console.error('Error updating pet:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        app.get('/pet', async (req, res) => {
            try {
                const { search, species, sort } = req.query;
                const query = {};
                if (search) {
                    query.petName = { $regex: search, $options: 'i' };
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

        app.get('/adoption-requests-by-pet/:petId', async (req, res) => {
            try {
                const { petId } = req.params;
                const result = await adoptionCollection.find({ petId: petId }).toArray();
                res.json(result);
            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        app.get('/my-listings', async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) {
                    return res.status(400).json({ message: "Owner email is required" });
                }
                const query = { ownerEmail: email };
                const result = await petCollection.find(query).sort({ createdAt: -1 }).toArray();
                res.json(result);
            } catch (error) {
                console.error('Error fetching user listings:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });


        app.get('/pet/:id', validateToken, async (req, res) => {
            try {
                const { id } = req.params;
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

        app.post('/adoption-request', async (req, res) => {
            try {
                const requestData = req.body;
                const result = await adoptionCollection.insertOne(requestData);
                res.status(201).json(result);
            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        app.get('/adoption-requests', async (req, res) => {
            try {
                const { email } = req.query;
                const result = await adoptionCollection.find({ userEmail: email }).toArray();
                res.json(result);
            } catch (error) {
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        app.patch('/adoption-requests/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status } = req.body; 

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: { status: status },
                };

                const result = await adoptionCollection.updateOne(filter, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: "Request not found" });
                }

                res.json({ message: "Updated successfully", result });
            } catch (error) {
                console.error("Error in PATCH:", error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        app.delete('/pet/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).json({ message: 'Failed to delete' });
            }
        });

        await client.db("admin").command({ ping: 1 });
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