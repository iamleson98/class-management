-- select name, permissions from roles where name like 'lms_%';

-- select * from users;
-- select * from teams;
-- select * from teammembers;
-- delete from users where id in ('yjzix3yfb7n1pekxybbaagw8ee', 'bzxkp3azbbr4tfphgedebwocne');
-- delete from users;
-- Town Square
-- select * from channels where id = 'sihj56u31jgemqyxr5q4aajqka';

-- select * from classes;

SELECT COUNT(*) FROM leads WHERE Status = 'NEW' AND EXTRACT(MONTH FROM createat) = EXTRACT(MONTH FROM CURRENT_TIMESTAMP) AND EXTRACT(YEAR FROM createat) = EXTRACT(YEAR FROM CURRENT_TIMESTAMP)
