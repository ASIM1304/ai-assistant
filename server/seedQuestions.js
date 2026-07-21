const mongoose = require("mongoose");
require("dotenv").config();

const Question = require("./src/models/Question");

const questions = [

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is JavaScript?",
  expectedTopics: [
    "Introduction",
    "Programming Language",
    "Web Development"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is the difference between var, let and const?",
  expectedTopics: [
    "Variables",
    "Scope",
    "Hoisting"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What are JavaScript data types?",
  expectedTopics: [
    "Primitive",
    "Objects",
    "Null",
    "Undefined"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "Explain == and === operators.",
  expectedTopics: [
    "Comparison",
    "Type Coercion",
    "Strict Equality"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is a function in JavaScript?",
  expectedTopics: [
    "Functions",
    "Parameters",
    "Return Values"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is an arrow function?",
  expectedTopics: [
    "ES6",
    "Arrow Functions",
    "this Keyword"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is hoisting?",
  expectedTopics: [
    "Execution Context",
    "Variables",
    "Functions"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is scope in JavaScript?",
  expectedTopics: [
    "Global Scope",
    "Block Scope",
    "Function Scope"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "What is the DOM?",
  expectedTopics: [
    "Document Object Model",
    "HTML",
    "Browser"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Easy",
  question: "How do you select HTML elements using JavaScript?",
  expectedTopics: [
    "querySelector",
    "getElementById",
    "DOM"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "Explain closures in JavaScript.",
  expectedTopics: [
    "Closures",
    "Lexical Scope",
    "Functions"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "What are promises?",
  expectedTopics: [
    "Promises",
    "Async Programming",
    "then"
  ]
},
{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "Explain async and await in JavaScript.",
  expectedTopics: [
    "Async",
    "Await",
    "Promises"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "What is event bubbling?",
  expectedTopics: [
    "Events",
    "DOM",
    "Propagation"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "What is event delegation?",
  expectedTopics: [
    "Events",
    "Performance",
    "DOM"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "Explain callback functions.",
  expectedTopics: [
    "Callbacks",
    "Functions",
    "Asynchronous Programming"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "What are template literals?",
  expectedTopics: [
    "ES6",
    "Strings",
    "Interpolation"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "What is destructuring in JavaScript?",
  expectedTopics: [
    "Objects",
    "Arrays",
    "ES6"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Medium",
  question: "Explain the spread and rest operators.",
  expectedTopics: [
    "Spread",
    "Rest",
    "ES6"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "Explain the JavaScript event loop.",
  expectedTopics: [
    "Event Loop",
    "Call Stack",
    "Microtasks"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "What are generators in JavaScript?",
  expectedTopics: [
    "Generators",
    "Yield",
    "Iterators"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "What is currying in JavaScript?",
  expectedTopics: [
    "Currying",
    "Functional Programming",
    "Closures"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "Explain memoization.",
  expectedTopics: [
    "Caching",
    "Optimization",
    "Performance"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "How do you optimize JavaScript performance in large applications?",
  expectedTopics: [
    "Performance",
    "Memory Management",
    "Optimization"
  ]
},
{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "What are JavaScript modules and why are they used?",
  expectedTopics: [
    "ES Modules",
    "CommonJS",
    "Import",
    "Export"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "Explain prototypal inheritance in JavaScript.",
  expectedTopics: [
    "Prototype",
    "Inheritance",
    "__proto__"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "What is the difference between synchronous and asynchronous programming?",
  expectedTopics: [
    "Async",
    "Promises",
    "Callbacks"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "How does garbage collection work in JavaScript?",
  expectedTopics: [
    "Memory",
    "Garbage Collection",
    "Heap"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "What is the difference between call(), apply(), and bind()?",
  expectedTopics: [
    "Functions",
    "this",
    "bind"
  ]
},

{
  domain: "JavaScript",
  difficulty: "Hard",
  question: "How would you build a scalable JavaScript application?",
  expectedTopics: [
    "Architecture",
    "Modules",
    "Performance"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What is React?",
  expectedTopics: [
    "Library",
    "Components",
    "UI"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What are the features of React?",
  expectedTopics: [
    "Virtual DOM",
    "JSX",
    "Components"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What is JSX?",
  expectedTopics: [
    "JSX",
    "Syntax",
    "Components"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What is the Virtual DOM?",
  expectedTopics: [
    "Virtual DOM",
    "Rendering",
    "Performance"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What are React components?",
  expectedTopics: [
    "Functional Components",
    "Class Components",
    "Props"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What are props in React?",
  expectedTopics: [
    "Props",
    "Data Passing",
    "Components"
  ]
},
{
  domain: "React",
  difficulty: "Easy",
  question: "What is state in React?",
  expectedTopics: [
    "State",
    "Component State",
    "Rendering"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What is the difference between state and props?",
  expectedTopics: [
    "State",
    "Props",
    "Data Flow"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What is useState()?",
  expectedTopics: [
    "Hooks",
    "State",
    "Functional Components"
  ]
},

{
  domain: "React",
  difficulty: "Easy",
  question: "What is useEffect()?",
  expectedTopics: [
    "Hooks",
    "Lifecycle",
    "Effects"
  ]
},

{
  domain: "React",
  difficulty: "Medium",
  question: "Explain the React component lifecycle.",
  expectedTopics: [
    "Lifecycle",
    "Mounting",
    "Unmounting"
  ]
},

{
  domain: "React",
  difficulty: "Medium",
  question: "What are React Hooks?",
  expectedTopics: [
    "Hooks",
    "useState",
    "useEffect"
  ]
},

{
  domain: "React",
  difficulty: "Medium",
  question: "What is Context API?",
  expectedTopics: [
    "Context API",
    "Global State",
    "Provider"
  ]
},

{
  domain: "React",
  difficulty: "Medium",
  question: "What is React Router?",
  expectedTopics: [
    "Routing",
    "Navigation",
    "SPA"
  ]
},

{
  domain: "React",
  difficulty: "Medium",
  question: "How do you optimize React performance?",
  expectedTopics: [
    "Memoization",
    "React.memo",
    "useMemo"
  ]
},

{
  domain: "React",
  difficulty: "Medium",
  question: "What is lazy loading in React?",
  expectedTopics: [
    "Lazy",
    "Suspense",
    "Performance"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "Explain reconciliation in React.",
  expectedTopics: [
    "Reconciliation",
    "Virtual DOM",
    "Diffing"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "How does React Fiber improve rendering?",
  expectedTopics: [
    "Fiber",
    "Concurrent Rendering",
    "Performance"
  ]
},
{
  domain: "React",
  difficulty: "Hard",
  question: "What is server-side rendering (SSR) in React?",
  expectedTopics: [
    "SSR",
    "Next.js",
    "Rendering"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "What is hydration in React?",
  expectedTopics: [
    "Hydration",
    "SSR",
    "DOM"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "Explain controlled and uncontrolled components.",
  expectedTopics: [
    "Forms",
    "State",
    "Refs"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "What is useMemo() and when should you use it?",
  expectedTopics: [
    "useMemo",
    "Performance",
    "Optimization"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "What is useCallback()?",
  expectedTopics: [
    "useCallback",
    "Hooks",
    "Performance"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "Explain React.memo().",
  expectedTopics: [
    "React.memo",
    "Performance",
    "Rendering"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "How do Error Boundaries work in React?",
  expectedTopics: [
    "Error Boundaries",
    "Lifecycle",
    "Error Handling"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "How would you manage state in a large React application?",
  expectedTopics: [
    "Redux",
    "Context API",
    "State Management"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "Explain React Suspense.",
  expectedTopics: [
    "Suspense",
    "Lazy Loading",
    "Concurrency"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "What are Higher Order Components (HOCs)?",
  expectedTopics: [
    "HOC",
    "Components",
    "Reuse"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "Explain custom hooks in React.",
  expectedTopics: [
    "Hooks",
    "Custom Hooks",
    "Code Reuse"
  ]
},

{
  domain: "React",
  difficulty: "Hard",
  question: "How would you build a scalable React application?",
  expectedTopics: [
    "Architecture",
    "Components",
    "Best Practices"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is Node.js?",
  expectedTopics: [
    "Runtime",
    "JavaScript",
    "Server"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "Why is Node.js used?",
  expectedTopics: [
    "Backend",
    "Performance",
    "Event Driven"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is npm?",
  expectedTopics: [
    "npm",
    "Packages",
    "Dependencies"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is package.json?",
  expectedTopics: [
    "package.json",
    "Dependencies",
    "Scripts"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is the Event Loop in Node.js?",
  expectedTopics: [
    "Event Loop",
    "Asynchronous",
    "Node.js"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What are modules in Node.js?",
  expectedTopics: [
    "Modules",
    "require",
    "CommonJS"
  ]
},
{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is the difference between Node.js and JavaScript?",
  expectedTopics: [
    "Runtime",
    "Browser",
    "Server"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is Express.js?",
  expectedTopics: [
    "Framework",
    "Routing",
    "Middleware"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "How do you read files in Node.js?",
  expectedTopics: [
    "fs",
    "readFile",
    "Filesystem"
  ]
},

{
  domain: "Node.js",
  difficulty: "Easy",
  question: "What is the Buffer class in Node.js?",
  expectedTopics: [
    "Buffer",
    "Binary Data"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "Explain middleware in Node.js.",
  expectedTopics: [
    "Middleware",
    "Express",
    "Request"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "What is asynchronous programming in Node.js?",
  expectedTopics: [
    "Async",
    "Promises",
    "Callbacks"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "How does Node.js handle multiple requests?",
  expectedTopics: [
    "Event Loop",
    "Non-blocking",
    "Concurrency"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "Explain streams in Node.js.",
  expectedTopics: [
    "Streams",
    "Readable",
    "Writable"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "What are child processes in Node.js?",
  expectedTopics: [
    "child_process",
    "Fork",
    "Spawn"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "What is clustering in Node.js?",
  expectedTopics: [
    "Cluster",
    "CPU",
    "Scaling"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "Explain process.nextTick().",
  expectedTopics: [
    "process",
    "Event Loop",
    "nextTick"
  ]
},

{
  domain: "Node.js",
  difficulty: "Medium",
  question: "How do you connect MongoDB with Node.js?",
  expectedTopics: [
    "Mongoose",
    "MongoDB",
    "Connection"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "How do you optimize a Node.js application?",
  expectedTopics: [
    "Performance",
    "Memory",
    "Optimization"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "Explain JWT authentication in Node.js.",
  expectedTopics: [
    "JWT",
    "Authentication",
    "Security"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "What is rate limiting and why is it important?",
  expectedTopics: [
    "Security",
    "Express",
    "Rate Limiting"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "How do you secure REST APIs in Node.js?",
  expectedTopics: [
    "Authentication",
    "Authorization",
    "Security"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "Explain memory leaks in Node.js.",
  expectedTopics: [
    "Memory",
    "Garbage Collection",
    "Performance"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "How would you build a scalable Node.js backend?",
  expectedTopics: [
    "Architecture",
    "Scaling",
    "Microservices"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "Explain WebSockets in Node.js.",
  expectedTopics: [
    "WebSocket",
    "Real-time",
    "Socket.io"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "What are worker threads in Node.js?",
  expectedTopics: [
    "Worker Threads",
    "Concurrency",
    "Performance"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "Describe your approach to designing a production-ready Node.js API.",
  expectedTopics: [
    "REST",
    "Security",
    "Scalability"
  ]
},

{
  domain: "Node.js",
  difficulty: "Hard",
  question: "How would you monitor and debug a Node.js application in production?",
  expectedTopics: [
    "Logging",
    "Monitoring",
    "Debugging"
  ]
},

{
  domain: "Express",
  difficulty: "Easy",
  question: "What is Express.js?",
  expectedTopics: [
    "Framework",
    "Routing",
    "Node.js"
  ]
},

{
  domain: "Express",
  difficulty: "Easy",
  question: "What is routing in Express?",
  expectedTopics: [
    "Routes",
    "HTTP Methods"
  ]
},

{
  domain: "Express",
  difficulty: "Easy",
  question: "What is middleware in Express?",
  expectedTopics: [
    "Middleware",
    "Request",
    "Response"
  ]
},

{
  domain: "Express",
  difficulty: "Easy",
  question: "How do you create a REST API using Express?",
  expectedTopics: [
    "REST",
    "CRUD",
    "Routes"
  ]
},

{
  domain: "Express",
  difficulty: "Medium",
  question: "Explain Express Router.",
  expectedTopics: [
    "Router",
    "Modular Routes"
  ]
},

{
  domain: "Express",
  difficulty: "Medium",
  question: "How do you handle errors in Express?",
  expectedTopics: [
    "Error Handling",
    "Middleware"
  ]
},

{
  domain: "Express",
  difficulty: "Medium",
  question: "How do you secure an Express application?",
  expectedTopics: [
    "Helmet",
    "JWT",
    "CORS"
  ]
},

{
  domain: "Express",
  difficulty: "Medium",
  question: "How do you validate incoming requests in Express?",
  expectedTopics: [
    "Validation",
    "express-validator"
  ]
},
{
  domain: "Express",
  difficulty: "Medium",
  question: "What is CORS and how do you enable it in Express?",
  expectedTopics: [
    "CORS",
    "Cross-Origin",
    "Middleware"
  ]
},

{
  domain: "Express",
  difficulty: "Medium",
  question: "How do you implement authentication in Express?",
  expectedTopics: [
    "JWT",
    "Authentication",
    "Middleware"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "How do you implement role-based authorization in Express?",
  expectedTopics: [
    "Authorization",
    "JWT",
    "RBAC"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "Explain request and response lifecycle in Express.",
  expectedTopics: [
    "Request",
    "Response",
    "Middleware"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "How do you upload files using Express?",
  expectedTopics: [
    "Multer",
    "Upload",
    "Files"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "How do you implement pagination in Express APIs?",
  expectedTopics: [
    "Pagination",
    "Query",
    "API"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "Explain API versioning in Express.",
  expectedTopics: [
    "API",
    "Versioning",
    "REST"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "How do you improve Express application performance?",
  expectedTopics: [
    "Performance",
    "Caching",
    "Compression"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "How do you deploy an Express application?",
  expectedTopics: [
    "Deployment",
    "Node.js",
    "Cloud"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "How do you test Express APIs?",
  expectedTopics: [
    "Testing",
    "Jest",
    "Supertest"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "What are common security vulnerabilities in Express applications?",
  expectedTopics: [
    "Helmet",
    "XSS",
    "CSRF"
  ]
},

{
  domain: "Express",
  difficulty: "Hard",
  question: "Describe the architecture of a scalable Express application.",
  expectedTopics: [
    "Architecture",
    "MVC",
    "Scalability"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Easy",
  question: "What is MongoDB?",
  expectedTopics: [
    "NoSQL",
    "Database",
    "Collections"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Easy",
  question: "What is a document in MongoDB?",
  expectedTopics: [
    "Document",
    "JSON",
    "BSON"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Easy",
  question: "What is a collection?",
  expectedTopics: [
    "Collection",
    "Documents"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Easy",
  question: "What is BSON?",
  expectedTopics: [
    "BSON",
    "Storage"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Easy",
  question: "Difference between SQL and MongoDB?",
  expectedTopics: [
    "SQL",
    "NoSQL"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Medium",
  question: "What are indexes in MongoDB?",
  expectedTopics: [
    "Indexes",
    "Performance"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Medium",
  question: "Explain aggregation pipeline.",
  expectedTopics: [
    "Aggregation",
    "Pipeline"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Medium",
  question: "How do you perform CRUD operations in MongoDB?",
  expectedTopics: [
    "CRUD",
    "Queries"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Medium",
  question: "What is Mongoose?",
  expectedTopics: [
    "Mongoose",
    "ODM"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Medium",
  question: "Explain schema validation in MongoDB.",
  expectedTopics: [
    "Schema",
    "Validation"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Medium",
  question: "What is population in Mongoose?",
  expectedTopics: [
    "Populate",
    "References"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "How do you optimize MongoDB queries?",
  expectedTopics: [
    "Indexes",
    "Optimization"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "Explain sharding in MongoDB.",
  expectedTopics: [
    "Sharding",
    "Scaling"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "What is replication in MongoDB?",
  expectedTopics: [
    "Replica Set",
    "High Availability"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "How do transactions work in MongoDB?",
  expectedTopics: [
    "Transactions",
    "ACID"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "Explain MongoDB Atlas.",
  expectedTopics: [
    "Atlas",
    "Cloud"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "How do you secure MongoDB?",
  expectedTopics: [
    "Authentication",
    "Authorization",
    "Encryption"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "Explain embedded documents vs references.",
  expectedTopics: [
    "Embedding",
    "References"
  ]
},

{
  domain: "MongoDB",
  difficulty: "Hard",
  question: "Describe a scalable MongoDB architecture.",
  expectedTopics: [
    "Scaling",
    "Cluster"
  ]
},

{
  domain: "SQL",
  difficulty: "Easy",
  question: "What is SQL?",
  expectedTopics: [
    "Database",
    "Queries"
  ]
},

{
  domain: "SQL",
  difficulty: "Easy",
  question: "What is a primary key?",
  expectedTopics: [
    "Primary Key",
    "Constraints"
  ]
},

{
  domain: "SQL",
  difficulty: "Easy",
  question: "What is a foreign key?",
  expectedTopics: [
    "Foreign Key",
    "Relationships"
  ]
},

{
  domain: "SQL",
  difficulty: "Easy",
  question: "Difference between DELETE, TRUNCATE and DROP?",
  expectedTopics: [
    "DDL",
    "DML"
  ]
},

{
  domain: "SQL",
  difficulty: "Medium",
  question: "What are joins in SQL?",
  expectedTopics: [
    "INNER JOIN",
    "LEFT JOIN",
    "RIGHT JOIN"
  ]
},

{
  domain: "SQL",
  difficulty: "Medium",
  question: "Explain normalization.",
  expectedTopics: [
    "Normalization",
    "Database Design"
  ]
},

{
  domain: "SQL",
  difficulty: "Medium",
  question: "What are indexes in SQL?",
  expectedTopics: [
    "Indexes",
    "Performance"
  ]
},

{
  domain: "SQL",
 difficulty: "Medium",
  question: "Write a query to find the second highest salary.",
  expectedTopics: [
    "Subquery",
    "Ranking",
    "SQL"
  ]
},
{
  domain: "SQL",
  difficulty: "Medium",
  question: "What is the difference between WHERE and HAVING?",
  expectedTopics: [
    "WHERE",
    "HAVING",
    "GROUP BY"
  ]
},

{
  domain: "SQL",
  difficulty: "Medium",
  question: "What is GROUP BY?",
  expectedTopics: [
    "GROUP BY",
    "Aggregation"
  ]
},

{
  domain: "SQL",
  difficulty: "Medium",
  question: "Explain UNION and UNION ALL.",
  expectedTopics: [
    "UNION",
    "UNION ALL"
  ]
},

{
  domain: "SQL",
  difficulty: "Medium",
  question: "What are SQL constraints?",
  expectedTopics: [
    "Constraints",
    "NOT NULL",
    "UNIQUE"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "Explain ACID properties.",
  expectedTopics: [
    "ACID",
    "Transactions"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "What is a transaction?",
  expectedTopics: [
    "Transaction",
    "COMMIT",
    "ROLLBACK"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "Difference between clustered and non-clustered indexes?",
  expectedTopics: [
    "Indexes",
    "Clustered",
    "Non-clustered"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "Explain SQL views.",
  expectedTopics: [
    "Views",
    "Virtual Table"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "What are stored procedures?",
  expectedTopics: [
    "Stored Procedure",
    "Functions"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "What are triggers in SQL?",
  expectedTopics: [
    "Triggers",
    "Events"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "How do you optimize SQL queries?",
  expectedTopics: [
    "Optimization",
    "Indexes",
    "Execution Plan"
  ]
},

{
  domain: "SQL",
  difficulty: "Hard",
  question: "Explain normalization vs denormalization.",
  expectedTopics: [
    "Normalization",
    "Denormalization"
  ]
},

{
  domain: "Java",
  difficulty: "Easy",
  question: "What is Java?",
  expectedTopics: [
    "OOP",
    "Platform Independent"
  ]
},

{
  domain: "Java",
  difficulty: "Easy",
  question: "What are the features of Java?",
  expectedTopics: [
    "Robust",
    "Portable",
    "Secure"
  ]
},

{
  domain: "Java",
  difficulty: "Easy",
  question: "Difference between JDK, JRE and JVM?",
  expectedTopics: [
    "JDK",
    "JRE",
    "JVM"
  ]
},

{
  domain: "Java",
  difficulty: "Easy",
  question: "What are primitive data types in Java?",
  expectedTopics: [
    "Primitive Types",
    "Variables"
  ]
},

{
  domain: "Java",
  difficulty: "Easy",
  question: "What is an object?",
  expectedTopics: [
    "Object",
    "Class"
  ]
},

{
  domain: "Java",
  difficulty: "Easy",
  question: "What is a class?",
  expectedTopics: [
    "Class",
    "Blueprint"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "Explain inheritance in Java.",
  expectedTopics: [
    "Inheritance",
    "extends"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "What is polymorphism?",
  expectedTopics: [
    "Polymorphism",
    "Method Overloading",
    "Method Overriding"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "Difference between abstract class and interface?",
  expectedTopics: [
    "Abstract",
    "Interface"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "Explain exception handling in Java.",
  expectedTopics: [
    "try",
    "catch",
    "finally"
  ]
},
{
  domain: "Java",
  difficulty: "Medium",
  question: "What is encapsulation in Java?",
  expectedTopics: [
    "Encapsulation",
    "Access Modifiers",
    "Data Hiding"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "What is method overloading?",
  expectedTopics: [
    "Overloading",
    "Compile Time Polymorphism"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "What is method overriding?",
  expectedTopics: [
    "Overriding",
    "Runtime Polymorphism"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "What is the difference between ArrayList and LinkedList?",
  expectedTopics: [
    "Collections",
    "ArrayList",
    "LinkedList"
  ]
},

{
  domain: "Java",
  difficulty: "Medium",
  question: "Explain HashMap in Java.",
  expectedTopics: [
    "HashMap",
    "Collections",
    "Key Value"
  ]
},

{
  domain: "Java",
  difficulty: "Hard",
  question: "What is multithreading in Java?",
  expectedTopics: [
    "Threads",
    "Concurrency"
  ]
},

{
  domain: "Java",
  difficulty: "Hard",
  question: "Explain synchronization in Java.",
  expectedTopics: [
    "Synchronization",
    "Thread Safety"
  ]
},

{
  domain: "Java",
  difficulty: "Hard",
  question: "What is the Java Memory Model?",
  expectedTopics: [
    "Heap",
    "Stack",
    "Memory"
  ]
},

{
  domain: "Java",
  difficulty: "Hard",
  question: "What are lambda expressions in Java?",
  expectedTopics: [
    "Lambda",
    "Functional Interface",
    "Java 8"
  ]
},

{
  domain: "Java",
  difficulty: "Hard",
  question: "How would you design a scalable Java application?",
  expectedTopics: [
    "Architecture",
    "Design Patterns",
    "Scalability"
  ]
},

{
  domain: "Python",
  difficulty: "Easy",
  question: "What is Python?",
  expectedTopics: [
    "Programming Language",
    "Interpreted",
    "High Level"
  ]
},

{
  domain: "Python",
  difficulty: "Easy",
  question: "What are Python's key features?",
  expectedTopics: [
    "Simple",
    "Dynamic Typing",
    "Open Source"
  ]
},

{
  domain: "Python",
  difficulty: "Easy",
  question: "What are Python data types?",
  expectedTopics: [
    "List",
    "Tuple",
    "Dictionary",
    "Set"
  ]
},

{
  domain: "Python",
  difficulty: "Easy",
  question: "Difference between list and tuple?",
  expectedTopics: [
    "Mutable",
    "Immutable"
  ]
},

{
  domain: "Python",
  difficulty: "Easy",
  question: "What is a dictionary in Python?",
  expectedTopics: [
    "Dictionary",
    "Key Value"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "Explain functions in Python.",
  expectedTopics: [
    "Functions",
    "Arguments",
    "Return"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "What are lambda functions?",
  expectedTopics: [
    "Lambda",
    "Anonymous Function"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "What is list comprehension?",
  expectedTopics: [
    "List Comprehension",
    "Loops"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "Explain exception handling in Python.",
  expectedTopics: [
    "try",
    "except",
    "finally"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "What are modules and packages?",
  expectedTopics: [
    "Modules",
    "Packages",
    "Import"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "What is PIP?",
  expectedTopics: [
    "PIP",
    "Packages"
  ]
},

{
  domain: "Python",
  difficulty: "Medium",
  question: "Explain OOP in Python.",
  expectedTopics: [
    "Class",
    "Object",
    "Inheritance"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "What is a decorator in Python?",
  expectedTopics: [
    "Decorator",
    "Functions"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "Explain generators in Python.",
  expectedTopics: [
    "Generator",
    "yield"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "Difference between multithreading and multiprocessing in Python?",
  expectedTopics: [
    "Threading",
    "Multiprocessing",
    "GIL"
  ]
},
{
  domain: "Python",
  difficulty: "Hard",
  question: "What is the Global Interpreter Lock (GIL)?",
  expectedTopics: [
    "GIL",
    "Threading",
    "Performance"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "How do you optimize Python code for performance?",
  expectedTopics: [
    "Optimization",
    "Profiling",
    "Performance"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "Explain virtual environments in Python.",
  expectedTopics: [
    "venv",
    "Virtual Environment",
    "Dependencies"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "How do you connect Python with a database?",
  expectedTopics: [
    "Database",
    "SQL",
    "MongoDB"
  ]
},

{
  domain: "Python",
  difficulty: "Hard",
  question: "Describe a production-ready Python application architecture.",
  expectedTopics: [
    "Architecture",
    "Scalability",
    "Best Practices"
  ]
},

{
  domain: "HR",
  difficulty: "Easy",
  question: "Tell me about yourself.",
  expectedTopics: [
    "Introduction",
    "Education",
    "Skills"
  ]
},

{
  domain: "HR",
  difficulty: "Easy",
  question: "Why should we hire you?",
  expectedTopics: [
    "Strengths",
    "Skills",
    "Confidence"
  ]
},

{
  domain: "HR",
  difficulty: "Easy",
  question: "What are your strengths?",
  expectedTopics: [
    "Strengths",
    "Examples"
  ]
},

{
  domain: "HR",
  difficulty: "Easy",
  question: "What are your weaknesses?",
  expectedTopics: [
    "Weaknesses",
    "Improvement"
  ]
},

{
  domain: "HR",
  difficulty: "Easy",
  question: "Why do you want to work at our company?",
  expectedTopics: [
    "Company",
    "Career",
    "Motivation"
  ]
},

{
  domain: "HR",
  difficulty: "Medium",
  question: "Describe a challenging situation you faced and how you handled it.",
  expectedTopics: [
    "Problem Solving",
    "STAR Method"
  ]
},

{
  domain: "HR",
  difficulty: "Medium",
  question: "Tell me about a time you worked in a team.",
  expectedTopics: [
    "Teamwork",
    "Communication"
  ]
},

{
  domain: "HR",
  difficulty: "Medium",
  question: "How do you handle pressure and deadlines?",
  expectedTopics: [
    "Stress Management",
    "Planning"
  ]
},

{
  domain: "HR",
  difficulty: "Medium",
  question: "Where do you see yourself in five years?",
  expectedTopics: [
    "Career Goals",
    "Growth"
  ]
},

{
  domain: "HR",
  difficulty: "Medium",
  question: "What motivates you?",
  expectedTopics: [
    "Motivation",
    "Learning"
  ]
},

{
  domain: "HR",
  difficulty: "Hard",
  question: "Describe a failure and what you learned from it.",
  expectedTopics: [
    "Failure",
    "Learning",
    "Growth"
  ]
},

{
  domain: "HR",
  difficulty: "Hard",
  question: "How do you resolve conflicts within a team?",
  expectedTopics: [
    "Conflict Resolution",
    "Communication"
  ]
},

{
  domain: "HR",
  difficulty: "Hard",
  question: "Describe your leadership experience.",
  expectedTopics: [
    "Leadership",
    "Decision Making"
  ]
},

{
  domain: "HR",
  difficulty: "Hard",
  question: "Why are you leaving your current role or why did you choose your degree?",
  expectedTopics: [
    "Career Decisions",
    "Honesty"
  ]
},

{
  domain: "HR",
  difficulty: "Hard",
  question: "Do you have any questions for us?",
  expectedTopics: [
    "Curiosity",
    "Company",
    "Role"
  ]
}

];
async function seedQuestions() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");

    await Question.deleteMany({});
    console.log("🗑 Old questions deleted");

    await Question.insertMany(questions);

    console.log(`✅ ${questions.length} questions inserted successfully`);

    await mongoose.disconnect();

    console.log("🎉 Seeding completed");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

seedQuestions();