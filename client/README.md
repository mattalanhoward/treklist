# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

Pack Planner 2.0

### Server Summary

1. Environment & Project Configuration
   .env
   Holds secrets and configuration; loaded at startup by dotenv in server.js:
   text
   CopyEdit
   MONGO_URI=mongodb://localhost:27017/treklist
   JWT_SECRET=your_super_secret_key_here
   PORT=5001
   .gitignore
   Ignore node modules, logs, .env, and editor/OS artifacts:
   gitignore
   CopyEdit
   node_modules/
   .env
   \*.log
   .DS_Store
   package.json
   Defines dependencies & scripts:
   jsonc
   CopyEdit
   {
   "name": "treklist-backend",
   "scripts": {
   "dev": "nodemon src/server.js",
   "start": "node src/server.js"
   },
   "dependencies": {
   "express": "^4.x", // web framework
   "mongoose": "^7.x", // MongoDB ODM
   "bcrypt": "^5.x", // password hashing
   "jsonwebtoken": "^9.x", // JWT creation/verification
   "dotenv": "^16.x" // loads .env
   },
   "devDependencies": {
   "nodemon": "^2.x" // auto-restart on file changes
   }
   }

2. Entry Points
   src/server.js
   Bootstraps the app:
   js
   CopyEdit
   require('dotenv').config(); // load .env
   const app = require('./app'); // configure Express + routes
   const PORT = process.env.PORT || 5000; // fallback port

app.listen(PORT, () => {
console.log(`🚀 Server running on http://localhost:${PORT}`);
});
src/app.js
Wires up middleware, database, and routes:
js
CopyEdit
const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const gearListRoutes = require('./routes/gearLists');
const categoriesRoutes= require('./routes/categories');
const gearItemRoutes = require('./routes/gearItems');

const app = express();

// parse JSON bodies
app.use(express.json());

// mount auth routes (no auth required here)
app.use('/api/auth', authRoutes);

// all gear-list, category, and item routes require a valid JWT
app.use('/api/lists', gearListRoutes);
app.use('/api/lists/:listId/categories', categoriesRoutes);
app.use('/api/lists/:listId/categories/:catId/items', gearItemRoutes);

// connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
useNewUrlParser: true,
useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

module.exports = app;

3. Authentication Middleware
   src/middleware/auth.js
   Reads the Authorization: Bearer <token> header
   Verifies the JWT against JWT_SECRET
   On success: attaches req.userId = payload.userId
   On failure: returns 401 Unauthorized
   js
   CopyEdit
   const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
const header = req.headers.authorization;
if (!header) return res.status(401).json({ message: 'No token' });
const [scheme, token] = header.split(' ');
if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: 'Bad auth format' });
try {
const payload = jwt.verify(token, process.env.JWT_SECRET);
req.userId = payload.userId;
next();
} catch {
res.status(401).json({ message: 'Invalid or expired token' });
}
};

4. Mongoose Models
   All models live in src/models/, each exporting a Mongoose model.
   user.js
   js
   CopyEdit
   const mongoose = require('mongoose');
   const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
email: { type: String, required: true, unique: true, lowercase: true, trim: true },
trailname: { type: String, required: true, trim: true },
passwordHash:{ type: String, required: true }
}, { timestamps: true });

// Hash a plain‐text password
userSchema.methods.setPassword = async function(pw) {
this.passwordHash = await bcrypt.hash(pw, 10);
};
// Validate password
userSchema.methods.validatePassword = async function(pw) {
return bcrypt.compare(pw, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
gearList.js
A “board” owned by one user:
js
CopyEdit
const mongoose = require('mongoose');

const gearListSchema = new mongoose.Schema({
owner: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
title: { type: String, required: true, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('GearList', gearListSchema);
category.js
A “list/column” within a gear list:
js
CopyEdit
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
gearList: { type: mongoose.Types.ObjectId, ref: 'GearList', required: true },
title: { type: String, required: true, trim: true },
position: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
gearItem.js
An “item/card” within a category:
js
CopyEdit
const mongoose = require('mongoose');

const gearItemSchema = new mongoose.Schema({
category: { type: mongoose.Types.ObjectId, ref: 'Category', required: true },
brand: String,
itemType: String,
name: { type: String, required: true },
description:String,
weight: { type: Number, required: true },
price: { type: Number, required: true },
link: String,
worn: { type: Boolean, default: false },
consumable: { type: Boolean, default: false },
quantity: { type: Number, default: 1 },
position: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GearItem', gearItemSchema);

5. Route Handlers
   All the routes use the auth middleware (except /auth) and perform CRUD plus ownership checks.
   auth.js (/api/auth)
   POST /register: create user, hash password, respond with JWT
   POST /login: verify credentials, respond with JWT
   js
   CopyEdit
   const express = require('express');
   const jwt = require('jsonwebtoken');
   const User = require('../models/user');
   const router = express.Router();

router.post('/register', async (req, res) => { /_..._/ });
router.post('/login', async (req, res) => { /_..._/ });

module.exports = router;
gearLists.js (/api/lists)
GET / → list all gear lists for req.userId
POST / → create new list with owner = req.userId
PATCH /:listId → rename, only if owned by req.userId
DELETE /:listId → delete, only if owned by req.userId
js
CopyEdit
const express = require('express');
const auth = require('../middleware/auth');
const GearList = require('../models/gearList');
const router = express.Router();

router.use(auth);
router.get('/', /_..._/);
router.post('/',/_..._/);
router.patch('/:listId',/_..._/);
router.delete('/:listId',/_..._/);

module.exports = router;
categories.js (/api/lists/:listId/categories)
GET / → all categories in list (sorted by position)
POST / → add category with given position
PATCH /:catId/position → reorder one category
DELETE /:catId → remove a category
js
CopyEdit
const router = express.Router({ mergeParams: true });
router.use(auth);
router.get('/',/_..._/);
router.post('/',/_..._/);
router.patch('/:catId/position',/_..._/);
router.delete('/:catId',/_..._/);
module.exports = router;
gearItems.js (/api/lists/:listId/categories/:catId/items)
GET / → all items in a category (sorted by position)
POST / → add a new item (name, weight, price, position required)
PATCH /:itemId → update any fields on an item
PATCH /:itemId/position → reorder one item
DELETE /:itemId → remove an item
js
CopyEdit
const router = express.Router({ mergeParams: true });
router.use(auth);
router.get('/',/_..._/);
router.post('/',/_..._/);
router.patch('/:itemId',/_..._/);
router.patch('/:itemId/position',/_..._/);
router.delete('/:itemId',/_..._/);
module.exports = router;

Flow Recap
Client sends requests to /api/...
app.js routes them to the correct router file
Auth middleware checks JWT and injects req.userId
Route handler validates inputs, enforces ownership, interacts with Mongoose models
Mongoose performs DB operations, returns JSON to client
With all these files in place you have a clean, modular backend—ready for your React frontend to consume!

#### Front End Next Steps

1. Scaffold the Front-end
   Initialize with Vite + ReactbashCopyEditcd treklist/frontend
   npm create vite@latest . --template react
   npm install

Add TailwindbashCopyEditnpm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
Configure tailwind.config.js and include Tailwind’s directives in your index.css.

2. Core Front-end Plumbing
   RoutingbashCopyEditnpm install react-router-dom
   Set up <BrowserRouter> with routes:
   /login
   /dashboard
   /lists/:listId
   API ServiceCreate src/services/api.js exporting an Axios instance with:
   baseURL = import.meta.env.VITE_API_URL
   Request interceptor to attach Authorization: Bearer <token> from localStorage.
   Auth Context / Hook
   useAuth() to expose { user, token, login, logout }.
   On login, save token to localStorage and context; on logout, clear both.
   Wrap your app in <AuthProvider> and guard private routes.

3. Pages & Components
   Login Page
   Form for email + password
   On submit → call POST /api/auth/login → store token → navigate to /dashboard.
   Dashboard
   Fetch GET /api/lists → display gear lists
   “New List” button → modal or inline form → POST /api/lists → refresh
   Search bar: call GET /api/items?search=… (global search across all lists) and show results.
   GearListView
   Fetch GET /api/lists/:listId/categories and for each:jsxCopyEdit<CategoryColumn id={cat._id} title={cat.title}>
   {items.map(item => <GearItemCard key={item._id} item={item} />)}
   </CategoryColumn>

Wrap all columns in your DndContextWrapper for reordering:
On category drag → PATCH /api/lists/:listId/categories/:catId/position
On item drag → PATCH /api/lists/:listId/categories/:catId/items/:itemId/position
Modals / Forms
Create/Edit Category form
Create/Edit GearItem form (all fields: name, weight, price, position, etc.)
Delete confirmations

4. State Management & UX
   Use React Context + useReducer or lightweight Zustand to keep your lists, categories, items in sync after mutations.
   Show loading spinners & error toasts (e.g. via a simple Toast component).

5. Polish & Deploy
   Styling
   Responsive layouts: flex containers that wrap on mobile.
   Tailwind utility classes for consistency.
   Basic Tests
   React Testing Library for critical flows: login, dashboard fetch, drag-and-drop reorder.
   Deployment
   Backend: push to Heroku/Render; set MONGO_URI, JWT_SECRET, and PORT in config.
   Frontend: build & deploy to Netlify/Vercel; set VITE_API_URL env var to your backend’s URL.

Where would you like to dive in first?
Bootstrapping the React/Tailwind project?
Building the auth context + login page?
Or prototyping the drag-and-drop board UI?
