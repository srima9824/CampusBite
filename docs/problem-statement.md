# CampusBite problem statement

Source: the owner's assignment, kept verbatim in substance. This file is the source of truth for scope.

Develop a full-stack restaurant ordering and delivery application called CampusBite.

CampusBite will allow customers to explore restaurants, browse food menus, place orders, and track their order status. Restaurant owners will be able to manage their menus and orders, while delivery partners will be able to manage their assigned deliveries.

The application must support three types of users: Customers, Restaurant Owners, and Delivery Partners. Each user should have access to features based on their assigned role.

You are required to build the frontend using React.js, the backend using FastAPI, and store application data in a relational SQL database. The FastAPI backend must be containerized using Docker.

## 1. Technology Stack

- Frontend: React.js, JavaScript (ES6+), React Hooks, React Router DOM, Fetch API or Axios
- Backend: Python, FastAPI, Pydantic, SQLAlchemy ORM, JWT Authentication, Docker and Docker Compose
- Database: SQL-based relational database, SQLAlchemy for database operations
- AI Integration: OpenAI API
- Version Control: Git and GitHub

## 2. User Roles and Functional Requirements

### A. Customer
Customers should be able to:
- Register and log in to their accounts.
- Browse available restaurants.
- View restaurant menus and food details.
- Search and filter dishes based on their names and prices.
- Add dishes to their cart.
- Update or remove items from their cart.
- Place food orders using a dummy payment system.
- View their order history.
- Track the status of their orders.
- Cancel orders when cancellation is allowed.
- Submit ratings and reviews after successful delivery.
- Request a return/refund after an order has been delivered.
- View AI-generated summaries and insights about their previous orders.

### B. Restaurant Owner
Restaurant owners should be able to:
- Log in to their accounts.
- Add new dishes to their restaurant menu.
- View, update, and manage existing dishes.
- Mark dishes as available or unavailable.
- View incoming orders for their restaurant.
- Accept orders and update their preparation status.
- Assign delivery partners to orders.
- Filter orders based on status and date.
- View basic restaurant statistics.
- Approve or reject customer return/refund requests.
- View reminders for orders that have not been updated for a specified period.

### C. Delivery Partner
Delivery partners should be able to:
- Log in to their accounts.
- View only the orders assigned to them.
- View customer delivery details.
- Update order status to Out for Delivery.
- Mark orders as Delivered.
- View their delivery history.

## 3. Authentication and Authorization

Implement authentication and role-based access control (RBAC).
- Users should be able to register and log in.
- Implement password hashing using bcrypt.
- Use JWT tokens for authentication.
- Support three roles: Customer, Restaurant Owner, and Delivery Partner.
- Protect frontend pages based on user roles.
- Protect backend APIs using authentication and authorization.
- Users should only be able to access data they are authorized to view or modify.
- Store the authentication token in localStorage and send it with protected API requests.

Important: Hiding buttons or pages on the frontend is not sufficient. Authorization must also be implemented on the backend.

## 4. Order Management and Lifecycle

Order lifecycle: PLACED, ACCEPTED, PREPARING, READY, ASSIGNED, OUT_FOR_DELIVERY, DELIVERED.
Additional statuses: CANCELLED, REFUNDED.

Rules:
- Customers can cancel orders only when the order is in PLACED status.
- Restaurant owners can accept orders and update their preparation status.
- Restaurant owners can assign delivery partners when an order is READY.
- Delivery partners can update only their assigned orders.
- Delivery partners can move orders from ASSIGNED to OUT_FOR_DELIVERY and then DELIVERED.
- Delivered orders cannot be cancelled.
- Invalid order status transitions must be rejected by the backend.

## 5. Dummy Payment and Return/Refund Management

### Dummy Payment
- Customers should be able to place orders without making an actual payment.
- Once an order is successfully placed, update its payment status to mock_paid.
- Maintain a payment record to track dummy payments.

### Return and Refund
- Customers can request a return/refund only after the order has been delivered.
- Customers must provide a reason for requesting a return/refund.
- Restaurant owners can approve or reject return/refund requests.
- If approved, update the payment status to refunded and maintain a refund record.
- If rejected, update the return status to rejected.
- A customer cannot submit multiple return requests for the same order.

## 6. Dashboard and Filtering

Implement separate dashboards for all three user roles.

- Customer dashboard: view previous and current orders; filter orders by status and date; view payment and return/refund status; cancel eligible orders; submit reviews and return requests.
- Restaurant owner dashboard: view incoming orders; filter orders by status and date; manage restaurant menus; assign delivery partners; view basic restaurant statistics; manage return/refund requests.
- Delivery partner dashboard: view assigned deliveries; filter deliveries by status; update delivery status; view delivery history.

Implement pagination wherever required for displaying large lists of records.

## 7. Applied AI - Order Insights

Integrate the OpenAI API to provide AI-powered order insights for customers.
- Customers should be able to request summaries of their previous orders.
- Customers should be able to ask questions about their order history.
- The backend should fetch the authenticated customer's order details from the database.
- Send the relevant order information to the OpenAI API.
- Display the generated response on the React frontend.
- Ensure customers cannot access another customer's order information through the AI feature.
- Store the OpenAI API key securely in backend environment variables.
- Implement basic error handling and rate-limit handling for API requests.

Example queries:
- Summarize my last five orders.
- Which of my orders are still not delivered?
- How much did I spend this week?
- Which food items have I ordered most frequently?

The AI feature should use the customer's actual order history as context. Embeddings, vector databases and RAG are not required.

## 8. Backend Middleware and Background Tasks

### Middleware
Implement middleware in FastAPI to:
- Log incoming request methods and API paths.
- Measure API response time.
- Handle request-level processing wherever required.

### Background Tasks
Remind restaurant owners about orders that have not been updated for more than 15 minutes.
- Identify orders that are still in PLACED or ACCEPTED status.
- Generate reminder records.
- Display reminders on the restaurant owner's dashboard.
- Real-time notifications and WebSockets are not required.

## 9. React Frontend Requirements

The entire frontend must be developed using React.js.
- Create reusable React components wherever possible.
- Use React Hooks such as useState, useEffect, and useContext wherever required.
- Use React Router DOM for navigation between different pages.
- Implement separate pages and dashboards for different user roles.
- Manage cart and user-related data using basic React state management.
- Integrate backend REST APIs using Fetch API or Axios.
- Implement loading states and error handling.
- Persist login information using localStorage.
- Send JWT tokens with protected API requests.
- Implement protected routes and role-based navigation.
- Ensure the application is responsive across desktop and mobile devices.

Suggested pages: Login and Registration; Restaurant Listing; Restaurant Menu; Cart and Checkout; Customer Dashboard; Restaurant Owner Dashboard; Menu Management; Order Management; Delivery Partner Dashboard; AI Order Insights.

Advanced state management libraries such as Redux or Zustand are not mandatory.

## 10. Database Requirements

Use a relational SQL database and the SQLAlchemy ORM for models and operations. Create tables for: Users, Restaurants, Menu Items, Orders, Order Items, Reviews, Payment Ledger, Admin Reminder Logs.

Relationships:
- Each customer can have multiple orders.
- Each restaurant can have multiple menu items and orders.
- Each order can contain multiple order items.
- Each delivered order can have one review.
- Each order can have multiple payment ledger entries.
- Delivery partners can be assigned to multiple orders.

Establish appropriate primary keys, foreign keys and relationships.

## 11. Backend Dockerization Requirements

- Create a Dockerfile for the FastAPI backend.
- Create a docker-compose.yml to configure and run the backend container.
- Configure the necessary environment variables.
- Ensure the backend starts correctly inside the container, exposes the required port and can connect to the SQL database.
- Keep API keys, database credentials and JWT secrets outside the Docker image and the GitHub repository.
- Provide an .env.example file with variable names and no secret values.
- The backend must be runnable locally using Docker Compose.

## 12. API Development Requirements

Develop RESTful APIs using FastAPI for: user registration and authentication; restaurant listing and menu management; order placement; order history and details; order status management; delivery partner assignment; reviews and ratings; return and refund management; AI-powered order insights; restaurant statistics and reminders.

Implement proper request validation, response handling and HTTP status codes. All business rules and authorization checks are enforced on the backend.

## 13. Deployment and Documentation

The GitHub repository must contain: complete React frontend source code; complete FastAPI backend source code; Dockerfile; docker-compose.yml; .env.example files wherever required; and a README.md with project overview, technologies used, features implemented, instructions to run the frontend locally, instructions to run the backend using Docker Compose, required environment variables, database setup instructions and API documentation details. No sensitive information is committed.

## 14. Expected Outcome

A functional full-stack restaurant ordering and delivery application where customers can browse restaurants, place orders, track deliveries and submit reviews; owners manage menus, orders and return/refund requests; delivery partners manage assigned deliveries; customers access AI-powered order insights; authentication and authorization are done properly; the React frontend talks to the FastAPI backend through REST APIs; the backend is containerized with Docker; and data is stored in a relational SQL database.

Submission: a public GitHub repository URL with all project files, no secrets.
