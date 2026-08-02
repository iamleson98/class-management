ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(13);
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS parent_id varchar(26);
ALTER TABLE IF EXISTS users
ADD CONSTRAINT fk_parent_id FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE
SET NULL;

CREATE TABLE IF NOT EXISTS branches (
    id varchar(26) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    address VARCHAR(200),
    phone VARCHAR(13),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
    id varchar(26) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    level VARCHAR(100),
    age_range VARCHAR(100),
    total_sessions integer NOT NULL,
    duration_per_session integer NOT NULL,
    fee decimal(10, 2),
    description VARCHAR(500),
    curriculum VARCHAR(1000),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS course_lessons (
    id varchar(26) PRIMARY KEY,
    course_id varchar(26) NOT NULL,
    session_number integer NOT NULL,
    title VARCHAR(200),
    unit VARCHAR(100),
    pages VARCHAR(100),
    objectives VARCHAR(500),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);

ALTER TABLE course_lessons
ADD CONSTRAINT fk_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS classes (
    id varchar(26) PRIMARY KEY,
    course_id varchar(26) NOT NULL,
    branch_id varchar(26) NOT NULL,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    teacher_id varchar(26) NOT NULL,
    status VARCHAR(50) NOT NULL,
    room VARCHAR(100),
    start_date DATE NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);

ALTER TABLE classes
ADD CONSTRAINT fk_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE classes
ADD CONSTRAINT fk_branch_id FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE classes
ADD CONSTRAINT fk_teacher_id FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE
SET NULL;

CREATE TABLE IF NOT EXISTS student_classes (
    id varchar(26) PRIMARY KEY,
    student_id varchar(26) NOT NULL,
    class_id varchar(26) NOT NULL,
    enrollment_at bigint NOT NULL,
    status VARCHAR(50) NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE student_classes
ADD CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE student_classes
ADD CONSTRAINT fk_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS lms_sessions (
    id varchar(26) PRIMARY KEY,
    title VARCHAR(200),
    class_id varchar(26) NOT NULL,
    start_time bigint NOT NULL,
    end_time bigint NOT NULL,
    room VARCHAR(100),
    teacher_id varchar(26) NOT NULL,
    lesson_id varchar(26) NOT NULL,
    status VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE lms_sessions
ADD CONSTRAINT fk_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE lms_sessions
ADD CONSTRAINT fk_teacher_id FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE
SET NULL;
ALTER TABLE lms_sessions
ADD CONSTRAINT fk_lesson_id FOREIGN KEY (lesson_id) REFERENCES course_lessons(id) ON DELETE
SET NULL;

CREATE TABLE IF NOT EXISTS attendances (
    id varchar(26) PRIMARY KEY,
    session_id varchar(26) NOT NULL,
    student_id varchar(26) NOT NULL,
    status VARCHAR(50) NOT NULL,
    note VARCHAR(500),
    locked boolean DEFAULT FALSE NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE attendances
ADD CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES lms_sessions(id) ON DELETE CASCADE;
ALTER TABLE attendances
ADD CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS fileinfo
ADD COLUMN IF NOT EXISTS course_id varchar(26);
ALTER TABLE IF EXISTS fileinfo
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE IF EXISTS fileinfo
ADD COLUMN IF NOT EXISTS visibility VARCHAR(50);
ALTER TABLE IF EXISTS fileinfo
ADD CONSTRAINT fk_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE
SET NULL;


CREATE TABLE leads (
    id varchar(26) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(13),
    age VARCHAR(20),
    school VARCHAR(100),
    source VARCHAR(100),
    need VARCHAR(500),
    status VARCHAR(50) NOT NULL,
    student_id varchar(26),
    notes VARCHAR(500),
    test_date DATE,
    test_result VARCHAR(50),
    test_score integer,
    counselor_id varchar(26),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE leads
ADD CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE
SET NULL;
ALTER TABLE leads
ADD CONSTRAINT fk_counselor_id FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE
SET NULL;

CREATE TABLE IF NOT EXISTS lead_activities (
    id varchar(26) PRIMARY KEY,
    lead_id varchar(26) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content VARCHAR(500),
    next_follow_up DATE NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE lead_activities
ADD CONSTRAINT fk_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS fee_packages (
    id varchar(26) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    total_fee decimal(10, 2) NOT NULL,
    course_id varchar(26) NOT NULL,
    sessions_included integer NOT NULL,
    discount_percent decimal(5, 2),
    is_active boolean DEFAULT TRUE NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE fee_packages
ADD CONSTRAINT fk_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS tuitions (
    id varchar(26) PRIMARY KEY,
    student_id varchar(26) NOT NULL,
    class_id varchar(26) NOT NULL,
    fee_package_id varchar(26) NOT NULL,
    total_amount decimal(10, 2) NOT NULL,
    discount_amount decimal(10, 2) DEFAULT 0 NOT NULL,
    paid_amount decimal(10, 2) DEFAULT 0 NOT NULL,
    remaining_amount decimal(10, 2) DEFAULT 0 NOT NULL,
    status VARCHAR(50) DEFAULT 'UNPAID' NOT NULL,
    due_date DATE,
    note VARCHAR(500),
    promotional_fee decimal(10, 2) DEFAULT 0,
    discount_value decimal(10, 2) DEFAULT 0,
    discount_type VARCHAR(50),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE tuitions
ADD CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tuitions
ADD CONSTRAINT fk_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE tuitions
ADD CONSTRAINT fk_fee_package_id FOREIGN KEY (fee_package_id) REFERENCES fee_packages(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS payments (
    id varchar(26) PRIMARY KEY,
    tuition_id varchar(26) NOT NULL,
    amount decimal(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    method VARCHAR(50) NOT NULL,
    receipt_number VARCHAR(100) UNIQUE,
    paid_by_id varchar(26) NOT NULL,
    note VARCHAR(500),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE payments
ADD CONSTRAINT fk_tuition_id FOREIGN KEY (tuition_id) REFERENCES tuitions(id) ON DELETE CASCADE;
ALTER TABLE payments
ADD CONSTRAINT fk_paid_by_id FOREIGN KEY (paid_by_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS fee_refunds (
    id varchar(26) PRIMARY KEY,
    tuition_id varchar(26) NOT NULL,
    amount decimal(10, 2) NOT NULL,
    refund_date DATE NOT NULL,
    reason VARCHAR(500),
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    approved_by_id varchar(26),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE fee_refunds
ADD CONSTRAINT fk_tuition_id FOREIGN KEY (tuition_id) REFERENCES tuitions(id) ON DELETE CASCADE;
ALTER TABLE fee_refunds
ADD CONSTRAINT fk_approved_by_id FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE
SET NULL;

CREATE TABLE IF NOT EXISTS post_categories (
    id varchar(26) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_posts (
    id varchar(26) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt VARCHAR(500),
    category_id varchar(26) NOT NULL,
    author_id varchar(26) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
    seo_title VARCHAR(200),
    seo_description VARCHAR(500),
    seo_keywords VARCHAR(200),
    published_at bigint,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE blog_posts
ADD CONSTRAINT fk_category_id FOREIGN KEY (category_id) REFERENCES post_categories(id) ON DELETE CASCADE;
ALTER TABLE blog_posts
ADD CONSTRAINT fk_author_id FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id varchar(26) PRIMARY KEY,
    student_id varchar(26) NOT NULL,
    class_id varchar(26) NOT NULL,
    week_number integer NOT NULL,
    content TEXT NOT NULL,
    rating integer,
    created_by varchar(26) NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);

ALTER TABLE weekly_reviews
ADD CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE weekly_reviews
ADD CONSTRAINT fk_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE weekly_reviews
ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS homeworks (
    id varchar(26) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    session_id varchar(26) NOT NULL,
    class_id varchar(26) NOT NULL,
    course_id varchar(26) NOT NULL,
    teacher_id varchar(26) NOT NULL,
    deadline DATE NOT NULL,
    createat bigint NOT NULL,
    file_id varchar(26) NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE homeworks
ADD CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES lms_sessions(id) ON DELETE CASCADE;
ALTER TABLE homeworks
ADD CONSTRAINT fk_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE homeworks
ADD CONSTRAINT fk_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE homeworks
ADD CONSTRAINT fk_teacher_id FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE homeworks
ADD CONSTRAINT fk_file_id FOREIGN KEY (file_id) REFERENCES fileinfo(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS submissions (
    id varchar(26) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    student_id varchar(26) NOT NULL,
    homework_id varchar(26) NOT NULL,
    description VARCHAR(500),
    file_id varchar(26) NOT NULL,
    feedback VARCHAR(500),
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE submissions
ADD CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE submissions
ADD CONSTRAINT fk_file_id FOREIGN KEY (file_id) REFERENCES fileinfo(id) ON DELETE CASCADE;
ALTER TABLE submissions
ADD CONSTRAINT fk_homework_id FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS class_media (
    id varchar(26) PRIMARY KEY,
    class_id varchar(26) NOT NULL,
    session_id varchar(26),
    title VARCHAR(200),
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    uploaded_by_id varchar(26) NOT NULL,
    file_id varchar(26) NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);

ALTER TABLE class_media
ADD CONSTRAINT fk_class_id FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE class_media
ADD CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES lms_sessions(id) ON DELETE SET NULL;
ALTER TABLE class_media
ADD CONSTRAINT fk_uploaded_by_id FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE class_media
ADD CONSTRAINT fk_file_id FOREIGN KEY (file_id) REFERENCES fileinfo(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS additional_fees (
    id varchar(26) PRIMARY KEY,
    tuition_id varchar(26) NOT NULL,
    label VARCHAR(100) NOT NULL,
    amount decimal(10, 2) NOT NULL,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);
ALTER TABLE additional_fees
ADD CONSTRAINT fk_tuition_id FOREIGN KEY (tuition_id) REFERENCES tuitions(id) ON DELETE CASCADE;
