# Multi-Tenant Cybersecurity Awareness Training Platform

## Overview

This is a comprehensive white-labeled cybersecurity training platform with multi-tenant architecture designed to deliver phishing simulations, AI-powered learning, and role-based security training. The platform supports three distinct user roles: Super Admins who manage the entire platform, Client Admins who customize and manage their company's training, and End Users who complete training modules and receive phishing simulations.

The application features a complete cybersecurity training ecosystem with real-time phishing campaign simulation, AI-powered course generation and chatbot assistance, comprehensive analytics and reporting, white-label branding customization, and user progress tracking with automated recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with React and TypeScript using Vite as the build tool. The UI leverages shadcn/ui components with Radix UI primitives for consistent, accessible design patterns. Styling is handled through Tailwind CSS with custom CSS variables for theme customization. The application uses wouter for routing and React Query (@tanstack/react-query) for state management and API caching. The component structure follows a feature-based organization with shared UI components and hooks.

### Backend Architecture
The server runs on Express.js with TypeScript support, following a RESTful API design. The architecture separates concerns into distinct service layers: authentication service for JWT-based security, OpenAI service for AI-powered features, SendGrid service for email delivery and tracking, S3 service for file uploads and asset management, and a storage abstraction layer for database operations. The API implements role-based access control with middleware-based authentication and authorization.

### Database Design
The application uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema supports multi-tenancy through a client-based isolation model with tables for users, clients, courses, phishing campaigns, analytics events, sessions, user progress tracking, and email templates. The database includes proper foreign key relationships and supports complex queries for analytics and reporting.

### Authentication & Authorization
JWT-based authentication with role-based access control (RBAC) supports three user roles with distinct permissions. Sessions are managed server-side with configurable expiration times. The system includes password hashing with bcrypt and secure token generation with proper validation and refresh mechanisms.

### Multi-Tenant Architecture
The platform implements client-based multi-tenancy where each client organization has isolated data and customizable branding. Subdomain-based routing enables white-label deployment. Client-specific branding includes custom logos, color schemes, email templates, and CSS overrides. The licensing system supports different tiers with user limits and feature restrictions.

### AI Integration
OpenAI integration provides dynamic course generation based on topics and difficulty levels, an intelligent chatbot for user assistance and recommendations, and automated quiz generation with personalized feedback. The AI services include content customization based on user progress and learning patterns.

### Email & Communications
SendGrid integration handles transactional emails, phishing simulation campaigns with tracking (open/click rates), and automated notifications. The system supports customizable email templates with client branding and comprehensive email delivery analytics.

### File Storage & Assets
AWS S3 integration manages logo uploads, course assets, email templates, and general file storage. The system includes proper access controls, file type validation, and CDN-optimized delivery for better performance.

## External Dependencies

- **Database**: PostgreSQL via Neon serverless with connection pooling
- **Email Service**: SendGrid for transactional emails and phishing campaigns
- **AI Services**: OpenAI for course generation and chatbot functionality
- **File Storage**: AWS S3 for asset management and file uploads
- **Authentication**: JWT with bcryptjs for password hashing
- **Frontend Framework**: React with TypeScript and Vite
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: React Query for server state and caching
- **Database ORM**: Drizzle with PostgreSQL dialect
- **Routing**: wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Date Handling**: date-fns for date manipulation and formatting