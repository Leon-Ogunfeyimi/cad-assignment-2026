## Cloud App Development - Assignment.

This repository contains an implementation of the serverless web API specified below, and the CDK code to provision its infrastructure for the AWS cloud. However, it is incomplete as there are bugs and missing features.

__Objective:__ Demonstrate your knowledge of serverless Web API design and deployment by completing the implementation.

__Completion Date:__ 10/11/26, midnight.

__CA mark:__ 45%.

__Deliverables:__

+ A text file (serverless-assignment.txt) containing:
   + The URL of the GitHub repository. 
   + The URL of the YouTube video demonstrating the API.

+ Upload the text file using [this Moodle link][moodle].

__Notes:__
+ To avoid plagiarism, you must set your GitHub repository visibility to PRIVATE. Shortly after the completion deadline, you will be requested to set it to public visibility to enable assessment.
+ Your repo's Git log __must have__ a clear, understandable, and coherent history of the work on this assignment. Each commit message must summarise the work performed (What task were you working on?) at each stage. __Failure to comply__ with this requirement will result in a minimal grade being awarded ( 20%-).

### Detailed Specification.

#### App API.

The Web API should support the following endpoints:

+ GET /movies/{movieID}/roles?[actor=actorID] - Get details of all roles for the specified movie. 
   + Support an optional query string parameter that specifies an actor ID, e.g. ?actor=4321. Only the role played by that actor in the movie should now be returned, if relevant.
+ GET /actors/{actorID}?[movie=movieID] - Return the specified actor's profile (DOB, bio, etc).
   + Support an optional query string parameter that specifies a movie ID. The response should now also include the description of the actor's role in the specified movie, if relevant. 
+ POST /movies/roles - add a movie role.

#### Data Model.
This application's domain data model comprises two entities, Movie and Actor, and one relationship, Role. The attributes of these data types are as follows:
+ Movie:
   + movie ID - number.
   + title - string.
   + release date - string.
   + overview - string.

+ Actor:
   + actor ID - number.
   + name - string.
   + date of birth - string.
   + bio - string.

+ Role:
   + movie ID - number.
   + actor ID - number.
   + role name - string.
   + role description - string.

#### DynamoDB table design.

The application's database will follow the *Single-table* design pattern. This means:
+ One table stores all the data (movies, actors and roles).
+ A table item could represent an entity (e.g. movie) or a relationship between entities (e.g. role). 

The table’s partition and sort keys contain entity IDs, and prefixes will be used to distinguish between the item types as follows: 

+ Movie - PK = m#movieID, SK = m#movieID.
+ Actor - PK = a#actorID, SK = a#actorID.
+ Role - PK = m#movieID, SK = a#actorID.

Sample table items are as follows:
+ A movie:
   + m#1234 | m#1234 | 1234 | The Shawshank Redemption | 05-03-1995 | A banker convicted of uxoricide forms a friendship over a quarter century with a hardened convict …
+ Actor:
   + a#4321 | a#4321 | 4321 | Morgan Freeman | 01-06-1937 |  An American actor, producer, and narrator. In a career spanning six decades, he has received numerous accolades, including an Academy Award and a Golden Globe Award, as well as ........
+ Role:
    + m#1234 | a#4321 | 1234 | 4321 | Ellis Boyd "Red" Redding  |  Serves as the film's narrator, deuteragonist, and emotional anchor. As a seasoned inmate serving a life sentence, Red is the "man who can get things," a contraband smuggler who becomes the best friend and protector of ....

#### Stack Architecture.

A multi-stack architecture should be used: one stack encapsulating user authentication requirements (Cognito stack), and a separate stack containing the application Web API (App API stack).

#### Authentication. 

Two forms of authentication will be used:
+ Username and password credentials for users.
+ An API key for the administrator.

The Cognito service manages user credentials. The Cognito stack should include a separate web API (the Auth API) to handle user authentication requests. It should allow users to self-register, log in, and log out. 

The administrator authenticates using an API key instead of a username and password. The key is generated at deployment time by the API Gateway service in the App API stack.

#### Authorisation.

Only authenticated users can perform HTTP GET requests, while an authenticated administrator can perform POST requests.

#### Logging.

The application should log all user requests to CloudWatch logs. A log entry should specify the request path and the Cognito username of the requester, e.g.

+  doconnor   /movies/1234/roles
+  jbloggs    /actors/4321?movie=1234

[The associated log streams are used for analysis, but this functionality is outside the scope of this assignment.] 

#### Grading spectrum.

+ 40-50% - All GET requests.

+ 51-65% - POST requests (no auth). Reasonable error handling.

+ 66-85% - Excellent error handling. API key authentication.

+ 86%+ - Excellent coding standard (aligned with provided code).

#### Advice

+ Responses should never return database items; they should only return model data, e.g. Actor, Role. Make use of the utility methods in `shared/model.ts`.

+ Responses with data should use the following structure:
~~~json
{
   "data":
     // model data  
} 
~~~

+ Query string and path parameters are interpreted as strings by the HTTP protocol, e.g. 1547 --> "1547". Consequently, you are never guaranteed that a parameter is a number even when it should be one.

+ Consider using the following implementation strategy:
     1. Complete GET request functionality, assuming the 'happy path'.
     1. Add error handling to GET processing.
     1. Ensure authentication works for GETs.
     1. Repeat the above steps for POST (excluding auth).
     1. Solve the API key requirement.
     1. Consider other error cases.
     1. Refactor at each stage to improve code quality, e.g. DRY, variable naming, redundant debugging code, etc.

[moodle]: https://moodle.setu.ie/mod/assign/view.php?id=4868989

---

## My implementation

I followed the strategy suggested above: GETs first, then GET error handling, then authentication and logging, then the POST and its error handling, then the API key, and finally some refactoring. Each of these is its own commit in the Git log.

### How to deploy

```
npm install
cdk deploy --all
```

This deploys two stacks: `CognitoStack` (user pool + Auth API) and `AppApiStack` (the movies API + DynamoDB table). The API URLs are printed in the outputs at the end.

### How to log in

**Users:** use the Auth API to sign up, confirm with the code Cognito emails you, then sign in.

- `POST /auth/signup` - `{ "username", "password", "email" }`
- `POST /auth/confirm_signup` - `{ "username", "code" }`
- `POST /auth/signin` - `{ "username", "password" }` - returns a token
- `POST /auth/signout`

Send the token to the App API in a cookie header: `Cookie: token=<token>`

**Admin:** the API key is created by API Gateway when the stack is deployed. The deploy output shows its ID (`AdminApiKeyId`). To get the actual key:

```
aws apigateway get-api-key --api-key <AdminApiKeyId> --include-value --query value --output text
```

Send it in a header: `x-api-key: <key>`

### Endpoints

#### GET /movies/{movieID}/roles?[actor=actorID]
Needs a signed-in user.
- `200` - all the roles in the movie, or just that actor's role if `actor` is given
- `400` - movieID or actor isn't a positive whole number
- `401` / `403` - not signed in, or the token is wrong or expired
- `404` - the movie doesn't exist, or that actor has no role in it

#### GET /actors/{actorID}?[movie=movieID]
Needs a signed-in user.
- `200` - the actor's profile, plus `roleDescription` if they have a role in the given movie
- `400` - actorID or movie isn't a positive whole number
- `401` / `403` - not signed in, or the token is wrong or expired
- `404` - the actor doesn't exist

#### POST /movies/roles
Needs the admin API key.

Body: `{ "movieId": 1234, "actorId": 4325, "roleName": "...", "roleDescription": "..." }`
- `201` - role added
- `400` - the body isn't valid JSON, or a field is missing or the wrong type
- `403` - no API key, or the wrong one
- `404` - the movie or actor doesn't exist
- `409` - that actor already has a role in that movie

### Logging

Every request is logged to CloudWatch with the Cognito username and the path, for example `userA   /movies/1234/roles?actor=4321`. The username comes from the authorizer, which passes it on to the lambdas. POST requests use the API key instead of a login, so they're logged as `admin`.

### Design decisions

- **Single table.** Movies, actors and roles are all in one DynamoDB table, using the `m#` / `a#` keys and the helper functions in `shared/model.ts`. Responses only return the model data (no `PK` / `SK`) inside `{ "data": ... }`.
- **Getting one actor's role.** For `?actor=`, I query on both the partition key and the sort key, so DynamoDB returns just that role instead of me filtering the results afterwards.
- **Adding a role safely.** Like the POST in Lab 5, I use a `TransactWriteCommand`. It checks the movie exists, checks the actor exists, and only adds the role if it isn't already there. If any check fails, nothing is written, and I use the reason to return a 404 or 409.
- **Checking the request body.** Lab 5 used AJV for this. I wrote a small check function (`invalidRoleFields`) instead, in the same style as `parseBody` in `auth-utils.ts`, so I didn't need to add any new packages.
- **Errors.** 500 errors are logged to CloudWatch, but the client only gets "Internal server error", so no internal details leak out.
- **Pagination.** A DynamoDB Query only returns up to 1 MB at a time, so `queryAll` keeps fetching pages until it has everything.