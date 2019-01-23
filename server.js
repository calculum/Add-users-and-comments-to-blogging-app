"use strict";

const express = require("express");
const morgan = require("morgan");
const mongoose = require("mongoose");

// Mongoose internally uses a promise-like object,
// but its better to make Mongoose use built in es6 promises
mongoose.Promise = global.Promise;

// config.js is where we control constants for entire
// app like PORT and DATABASE_URL
const { PORT, DATABASE_URL } = require("./config");
const { BlogPost,Author } = require("./models");

const app = express();
app.use(express.json());

// GET requests to /authors
app.get("/authors", (req, res) => {
  Author
      .find()
      .then(authors => {
        res.json(authors.map(author => {
          return {
            id: author._id,
            name:`${author.firstName} ${author.lastName}`,
            userName: author.userName
          };
        }));
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Can not get blog authors.'});
      });
});

app.post('/authors', (req,res) => {
  const requireFileds = ['firstName', 'lastName', 'userName'];
  requireFileds.forEach(field => {
    if(! (field in req.body)) {
      const message = `Missing \`${field}\` in request body`;
      console.error(message);
      return res.status(400).send(message);
    };
  });
  Author
    .findOne({ userName: req.body.userName})
    .then(author => {
      if (author) {
        const message = `Username already exists`;
        console.error(message);
        return res.status(400).send(message);
      }
      else {
        Author
            .create({
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              userName: req.body.userName
            })
            .then(author => res.status(201).json({
              _id:author.id,
              name:`${author.firstName} ${author.lastName}`,
              userName: author.userName
            }))
            .catch(err => {
              console.error(err);
              res.status(500).json({error: 'Error'});
            });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'Somrthing goes wrong'});
    });
});

app.put('/authors/:id', (req, res) => {
  if (!(req.params.id && req.boby.id && req.params.id === req.body.id)) {
    res.status(400).json({
      error: 'Request path id and request body id values must match'
    });
  }

  const updated = {};
  const updateableFields = ['firstName', 'lastName', 'userName'];
  updateableFields.forEach(field => {
    if (field in req.body) {
      updated[field] = req.body[field];
    }
  });

  Author
      .findOne({})

})




app.get('/posts', (req, res) => {
  BlogPost
    .find()
    .then(posts => {
      res.json(posts.map(post => {
        return {
          id: post._id,
          author: post.authorName,
          content: post.content,
          title: post.title
        };
      }));
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Can not get blog posts.' });
    });
});
// can also request by ID
app.get("/posts/:id", (req, res) => {
    BlogPost
        .findById(req.param.id)
        .then(post => res.json(post.serialize()))
        .catch(err => {
          console.error(err);
          res.status(500).json({ error: 'Not able to GET by Id'});
        });
});

app.post("/posts", (req, res) => {
    const requireFileds = ['title', 'content', 'author'];
    for (let i = 0; i < requireFileds.length; i++) {
      const field = requireFileds[i];
      if (!(field in req.body)) {
        const message = `Missing \`${field}\` in request body`;
        console.error(message);
        return res.status(400).send(message);
      }
    }

    BlogPost
        .create({
          title: req.body.title,
          content: req.body.content,
          author: req.body.author
        })
        .then(blogPost => res.status(201).json(blogPost.serialize()))
        .catch(err => {
          console.log(err);
          res.status(500).json({ error: 'Not able to create post'});
        });
});

app.put("/posts/:id", (req, res) => {
  // ensure that the id in the request path and the one in request body match
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
        res.status(400).json({
          error: ' Request id and Body id must match.'
        });
  }



  // we only support a subset of fields being updateable.
  // if the user sent over any of the updatableFields, we udpate those values
  // in document
  const updated = {};
  const updateableFields = ["title", "content", "author"];

  updateableFields.forEach(field => {
    if (field in req.body) {
      updated[field] = req.body[field];
    }
  });

  BlogPost
    // all key/value pairs in 'updated' will be updated -- that's what `$set` does
    .findByIdAndUpdate(req.params.id, { $set: updated }, {new: true})
    .then(restaurant => res.status(204).end())
    .catch(err => res.status(500).json({ message: "Internal server error" }));
});

app.delete("/posts/:id", (req, res) => {
    blogPost
        .findByIdAndRemove(req.param.id)
        .then(() => {
          res.status(204).json({message: 'Delete successful.'});
        })
        .catch(err => {
          console.error(err);
          res.status(500).json({ error: 'Delete is NOT successful.'})
        })
});

app.delete('/:id', (req,res) => {
  blogPost
      .findByIdAndRemove(req.param.id)
      .then(() => {
        console.log(`Post deleted with id \`${req.param}\``);
        res.status(204).end();
      });
})

// catch-all endpoint if client makes request to non-existent endpoint
app.use("*", function(req, res) {
  res.status(404).json({ message: "Not Found" });
});

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl, port = PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(
      databaseUrl,
      err => {
        if (err) {
          return reject(err);
        }
        server = app
          .listen(port, () => {
            console.log(`Your app is listening on port ${port}`);
            resolve();
          })
          .on("error", err => {
            mongoose.disconnect();
            reject(err);
          });
      }
    );
  });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log("Closing server");
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };
