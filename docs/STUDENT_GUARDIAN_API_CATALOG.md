# EDUCATIONOS — STUDENT & GUARDIAN API CATALOG
**Document Reference:** `docs/STUDENT_GUARDIAN_API_CATALOG.md`  
**Classification:** Authoritative Technical Interface Specification  
**Version:** 2.0 (Post-Reconstruction)  
**Backend Framework:** FastAPI, SQLAlchemy 2.0, PostgreSQL RLS, Pydantic v2  

---

## 1. Authentication & Account Lifecycle Endpoints

### 1.1. Guardian Secure Login
- **Route:** `POST /api/v1/auth/guardian/login` (Alias: `POST /api/v1/auth/guardian`)
- **Authorization:** Public (Subject to IP & Account Rate Limiting)
- **Request Payload:**
  ```json
  {
    "identifier": "01711223344",
    "password": "GuardianSecretPassword123!",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "school_code": "kids-shine"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "role": "guardian",
    "name": "Farid Ahmed (Guardian)",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "guardian_id": "c1f72d54-8c01-447a-8742-fa32d431bb5c"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Invalid credentials, account not yet activated, or missing password.
  - `429 Too Many Requests`: Account or IP exceeded attempt threshold (Retry-After header provided).

### 1.2. Student Secure Login
- **Route:** `POST /api/v1/auth/student`
- **Authorization:** Public (Rate Limited)
- **Request Payload:**
  ```json
  {
    "admission_number": "KS-2026-001",
    "password": "StudentPermanentPassword123!",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "role": "student",
    "name": "Rafiq Ahmed",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "student_id": "8b51d8b2-3fc4-4d8b-b789-22cb8592c301"
  }
  ```

### 1.3. Consume Single-Use Activation Invitation Token
- **Route:** `POST /api/v1/auth/activate`
- **Authorization:** Public
- **Request Payload:**
  ```json
  {
    "token": "ACT-7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    "password": "PermanentSecurePassword123!"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Account activated successfully. You can now sign in with your permanent password.",
    "role": "student",
    "username": "KS-2026-001"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Token expired, malformed, or previously consumed (replay attack blocked).
  - `404 Not Found`: Associated user profile does not exist.

---

## 2. Guardian–Student Relationship & Child Portal Endpoints

### 2.1. List Verified Children
- **Route:** `GET /api/v1/guardians/me/children`
- **Authorization:** Bearer Token (`role: guardian`)
- **Response `200 OK`:**
  ```json
  [
    {
      "student_id": "8b51d8b2-3fc4-4d8b-b789-22cb8592c301",
      "name": "Rafiq Ahmed",
      "admission_number": "KS-2026-001",
      "class_name": "Class 5",
      "section": "A",
      "roll_number": "01",
      "relationship": "Father",
      "verification_status": "VERIFIED"
    }
  ]
  ```

### 2.2. Get Verified Child's Official Progress Card
- **Route:** `GET /api/v1/guardians/me/children/{student_id}/progress-card`
- **Authorization:** Bearer Token (`role: guardian`)
- **Query Parameters:**
  - `exam_term` (optional string): e.g. `Half Yearly Examination - 2026`
- **Access Rule:** Enforces `GuardianStudentLink.verification_status == 'VERIFIED'`. Unlinked or revoked links return `403 Forbidden`.
- **Response `200 OK`:**
  ```json
  {
    "student_id": "8b51d8b2-3fc4-4d8b-b789-22cb8592c301",
    "student_name": "Rafiq Ahmed",
    "admission_number": "KS-2026-001",
    "class_name": "Class 5",
    "roll_number": "01",
    "exam_term": "Half Yearly Examination - 2026",
    "total_marks": 375.0,
    "gpa": 4.88,
    "overall_grade": "A+",
    "subjects": [
      {
        "subject": "Mathematics",
        "marks_obtained": 95.0,
        "grade": "A+",
        "grade_point": 5.0,
        "remarks": "Outstanding"
      }
    ]
  }
  ```

### 2.3. Request Guardian–Student Relationship Link
- **Route:** `POST /api/v1/guardians/link-request`
- **Authorization:** Bearer Token (`role: guardian`)
- **Request Payload:**
  ```json
  {
    "student_admission_number": "KS-2026-002",
    "relationship_type": "Mother",
    "birth_certificate_no": "20152692518104523"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "status": "pending_verification",
    "message": "Link request submitted successfully. Verification required by school administration.",
    "request_id": "76428fa0-681b-4fa8-b2ef-37dc6b856c80"
  }
  ```

---

## 3. Student Workspace & Dashboard Endpoints

### 3.1. Get Student Dashboard Overview
- **Route:** `GET /api/v1/students/me/dashboard`
- **Authorization:** Bearer Token (`role: student`)
- **Response `200 OK`:**
  ```json
  {
    "student": {
      "id": "8b51d8b2-3fc4-4d8b-b789-22cb8592c301",
      "first_name": "Rafiq",
      "last_name": "Ahmed",
      "admission_number": "KS-2026-001",
      "class_name": "Class 5",
      "roll_number": "01"
    },
    "attendance_percentage": 94.5,
    "today_status": "Present",
    "term_gpa": 4.88,
    "academic_standing": "Good Standing"
  }
  ```

### 3.2. Get Student's Own Official Progress Card
- **Route:** `GET /api/v1/results/progress-card/{student_id}`
- **Authorization:** Bearer Token (`role: student` where `student_id == claims.sub`, or `role: admin`/`teacher`)
- **Access Rule:** Students can ONLY access their own progress card. Requesting another student's ID returns `403 Forbidden`. Only published results (`is_published: true`) are displayed.

---

## 4. Student Learning Studio Endpoints

### 4.1. Socratic AI Tutor
- **Route:** `POST /api/v1/learning-studio/socratic-tutor`
- **Authorization:** Bearer Token (`role: student`, `admin`, `teacher`)
- **Request Payload:**
  ```json
  {
    "subject": "Mathematics",
    "problem_text": "Solve for x: 2x + 10 = 24",
    "student_previous_step": "I tried subtracting 10"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "subject": "Mathematics",
    "guidance": "Great first step! When you subtract 10 from both sides of 2x + 10 = 24, what does the equation simplify to? What operation should you perform next to isolate x?",
    "confidence_rating": 0.98,
    "model_version": "gemini-1.5-flash-socratic"
  }
  ```

### 4.2. Log Focus Study Room Session
- **Route:** `POST /api/v1/learning-studio/study-room/session`
- **Authorization:** Bearer Token (`role: student`)
- **Request Payload:**
  ```json
  {
    "subject": "Physics",
    "topic": "Newtonian Dynamics",
    "duration_minutes": 25,
    "notes": "Reviewed Second Law of Motion calculations."
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "session_id": "e912f24b-37ca-41df-965a-8b8396ca2608",
    "status": "recorded",
    "duration_minutes": 25,
    "recorded_at": "2026-11-11T08:00:00+06:00"
  }
  ```

### 4.3. Interactive Flashcards (Get & Create)
- **Route:** `GET /api/v1/learning-studio/flashcards`
  - **Authorization:** Bearer Token
  - **Query Parameters:** `subject` (optional)
  - **Response `200 OK`:** Array of `StudyFlashcard` objects scoped to tenant and user.
- **Route:** `POST /api/v1/learning-studio/flashcards`
  - **Authorization:** Bearer Token
  - **Request Payload:**
    ```json
    {
      "subject": "Chemistry",
      "front_prompt": "What is Avogadro's constant?",
      "back_explanation": "6.022 × 10^23 mol^-1"
    }
    ```

### 4.4. Practice Quiz Generation & Evaluation
- **Route:** `POST /api/v1/learning-studio/practice-quiz/generate`
  - **Request Payload:** `{ "subject": "Mathematics", "topic": "Fractions", "class_name": "Class 6", "count": 5 }`
  - **Response `200 OK`:** Object containing list of questions with option arrays (correct answers stripped from client payload).
- **Route:** `POST /api/v1/learning-studio/practice-quiz/submit`
  - **Request Payload:** `{ "subject": "Mathematics", "topic": "Fractions", "answers": { "q1": 0, "q2": 2 } }`
  - **Response `200 OK`:** Score, total, accuracy percentage, and detailed explanations for all questions.

### 4.5. Student Learning Analytics
- **Route:** `GET /api/v1/learning-studio/analytics`
- **Authorization:** Bearer Token (`role: student`)
- **Response `200 OK`:**
  ```json
  {
    "total_study_minutes": 320,
    "study_sessions_count": 8,
    "practice_attempts_count": 5,
    "average_accuracy_percentage": 88.0,
    "daily_streak_days": 4,
    "subject_breakdown": {
      "Mathematics": 180,
      "Physics": 140
    }
  }
  ```

