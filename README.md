📊 Tabuledge

A web-based accounting and finance application built for SWE 4713 – Software Application Domain.
This repo contains the Sprint 1 deliverables: authentication system, role separation, and admin user management.

🚀 Features Implemented (Sprint 1)

Authentication

Login with email & password (Firebase Auth)

Forgot password (reset email via Firebase)

Lock account after 3 failed login attempts

Password expiration warning (90 days, alerts 3 days before)

Password Rules

Minimum 8 characters

Must include a letter, a number, and a special character

Must start with a letter

Checked live using react-password-checklist

User Management

Create New User request form (first name, last name, address, DOB, email, password)

Auto-generated usernames → first initial + lastname + MMYY (e.g., jdoe0925)

Requests stored in Firestore under userRequests

Admin Panel:

View all pending requests

Approve request → promote to users collection

Reject request

View existing users with role & status

Activate/deactivate users

Role Separation

Dashboards created for:

👑 Admin (/admin)

📊 Manager (/manager)

💼 Accountant (/accountant)

🛠️ Tech Stack

Frontend: React (via Create React App)

Backend / Auth / DB: Firebase Authentication + Firestore

UI Libraries: React Router, Material UI (planned), React Password Checklist

Hosting: Netlify (planned for deployment)

⚙️ Setup Instructions

Clone the repository and install dependencies:

git clone https://github.com/audelelcubano/tabuledge.git
cd tabuledge
npm install
npm start


This will launch the dev server at http://localhost:3000/.

📌 Next Steps (Upcoming Sprints)

Role-based redirect after login (admin → /admin, manager → /manager, accountant → /accountant)

Let admin assign/change roles when approving requests

Admin: suspend users for date ranges

Admin: report of expired passwords

Admin: send emails directly from system (via SMTP.js / Elastic Email)

Display logged-in user’s name + profile picture top-right