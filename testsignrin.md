STT	Test case ID	Module	Test case decription	Pre  - Condition	Step	Data	Excepted Result	Test Date	Actual Result	Status	Assign to
2.1	TC_SI_01	Login	Successful Login after Register	"User is a Guest.
User must have a registered account"	"1. Navigate to the Login form (Email/Password).
2. Enter valid Email and Password of the registered account.
3. Click the ""Login"" button."	"Email:Nguyendao131299@gmail.com
Password:Dao13122003."	"1. Success: User is authenticated successfully.
2. Redirect: User is redirected to the Total Overview page"	10-Thg10	"1. Success: User is authenticated successfully.
2. Redirect: User is redirected to the Total Overview page"	Pass	Nguyen Thi Dao
2.2	TC_SI_02	Login	Login with Invalid Email	User is a Guest.	"1. Enter an Email that does not exist.
2. Enter a random Password.
3. Click the ""Login"" button."	"Email:dao@gmail.com
Password:Dao13122003."	System displays an error message: "Invalid email or password". User remains on the login page.	10-Thg10	System displays an error message: "Invalid email or password". User remains on the login page.	Pass	Nguyen Thi Dao
2.3	TC_SI_03	Login	Login with Invalid Password	"User is a Guest.
User has a valid account."	"1. Enter a valid Email.
2. Enter an incorrect Password.
3. Click the ""Login"" button."	"Email:Nguyendao@gmail.com
Password:Dao13122003@"	System displays an error message: "Invalid email or password". User remains on the login page.	10-Thg10	The system does not report errors and leaves fields blank during login.	Fail	Nguyen Thi Dao
2.4	TC_SI_04	Login	Login with Email field empty	User is a Guest.	"1. Leave the Email field empty.
2. Enter a Password.
3. Click the ""Login"" button."	Email: (Empty)	System displays a required field validation error for the Email field.	10-Thg10	System displays a required field validation error for the Email field.	Pass	Nguyen Thi Dao
2.5	TC_SI_05	Login	Login with Locked Account	"User is a Guest.
The test account's status has been set to Locked by Admin"	"1. Enter valid Email and Password of the Locked account.
2. Click the ""Login"" button."	Email: locked@test.com	System prevents login and shows error: "Your account has been locked/suspended".	10-Thg10	System displays error message: "Your account is locked. Please contact Admin" and stays on Login page.	Blocked	Nguyen Thi Dao
2.6	TC_SI_06	Login	Email Validation - Missing '@' symbol	User is on the Login page.	"1. Enter Email without '@' (e.g., nguyendao131299gmail.vn).
2. Enter a valid password.
3. Click ""Đăng nhập"" (Login)."	Email: nguyendao131299gmail.vn	Client-side Error: Browser tooltip appears saying "Please include an '@' in the email address..." (Vui lòng bao gồm '@'...). Form is not submitted.	10-Thg10	Client-side Error: Browser tooltip appears saying "Please include an '@' in the email address..." (Vui lòng bao gồm '@'...). Form is not submitted.	Pass	Nguyen Thi Dao
2.7	TC_SI_07	Login	Email Validation - Dot '.' used incorrectly	User is on the Login page.	"1. Enter Email with a dot at the end of the domain part (e.g., ...gmail.).
2. Enter a valid password.
3. Click ""Đăng nhập""."	Email: nguyendao131299@gmail.	Client-side Error: Browser tooltip appears saying "'.' is used at a wrong position in 'gmail.'." ('.' bị sử dụng sai vị trí...). Form is not submitted.	10-Thg10	Client-side Error: Browser tooltip appears saying "'.' is used at a wrong position in 'gmail.'." ('.' bị sử dụng sai vị trí...). Form is not submitted.	Pass	Nguyen Thi Dao
2.8	TC_SI_08	Login	Login with Non-existent/Invalid Domain (System Error Handling)	User is on the Login page.	"1. Enter an Email with a strange/unsupported domain (e.g., .vec).
2. Click ""Đăng nhập""."	Email: nguyendao131299@gmail.vec	System displays an error message: "Invalid email or password". User remains on the login page.	10-Thg10	The system does not report errors and leaves fields blank during login.	Fail 	Nguyen Thi Dao
