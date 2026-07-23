CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(26) NOT NULL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    assignee_id VARCHAR(26) NOT NULL,
    creator_id VARCHAR(26) NOT NULL,
    deadline DATE,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'TODO',
    notes VARCHAR(500),
    createat bigint NOT NULL,
    updateat bigint NOT NULL,
    CONSTRAINT fk_tasks_assignee_id FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_creator_id FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS banners (
    id VARCHAR(26) NOT NULL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    image_url VARCHAR(500),
    link_url VARCHAR(500),
    position integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT TRUE,
    createat bigint NOT NULL,
    updateat bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(26) NOT NULL PRIMARY KEY,
    user_id VARCHAR(26) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message VARCHAR(500) NOT NULL,
    type VARCHAR(50),
    is_read boolean NOT NULL DEFAULT FALSE,
    link_url VARCHAR(500),
    createat bigint NOT NULL,
    updateat bigint NOT NULL,
    CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(26) NOT NULL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    course_id VARCHAR(26) NOT NULL,
    unit VARCHAR(100),
    visibility VARCHAR(50) NOT NULL DEFAULT 'TEACHER_ONLY',
    file_id VARCHAR(26) NOT NULL,
    uploaded_by_id VARCHAR(26) NOT NULL,
    version integer NOT NULL DEFAULT 1,
    createat bigint NOT NULL,
    updateat bigint NOT NULL,
    CONSTRAINT fk_materials_course_id FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_materials_file_id FOREIGN KEY (file_id) REFERENCES fileinfo(id) ON DELETE CASCADE,
    CONSTRAINT fk_materials_uploaded_by_id FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE CASCADE
);
