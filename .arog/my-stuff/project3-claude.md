# ADP E-Automation Testing Framework - Claude Documentation

## Project Overview

This is a Playwright-based end-to-end automation testing framework for ADP's e-platform. The framework is designed to test the full lifecycle of small business payroll operations, including company setup, employee management, payroll processing, tax handling, and various HR-related workflows.

**Key Information:**

- **Framework**: Playwright (v1.45.1)
- **Language**: TypeScript
- **Testing Pattern**: Page Object Model (POM)
- **Platform**: ADP e-Platform (Small Business Payroll)
- **Author**: Roll QA team

---

## Repository Structure

```
adp-e-automation/
├── config/                         # Environment configurations
│   └── default.js                  # Multi-environment config (DEV, DIT, FIT, STG, SB, PROD, PaaS)
├── controllers/                    # Business logic controllers for handling form interactions
│   ├── employeeController.ts       # Employee/Worker form handling
│   ├── addressController.ts        # Address-related form handling
│   ├── balanceController.ts        # Balance management
│   └── ...
├── fixtures/                       # Shared test setup and teardown logic
│   └── fixtures.ts
├── page-objects/                   # Page Object Model classes
│   ├── basePage.ts                 # Base page with common functionality
│   ├── login.page.ts               # Login page interactions
│   ├── chat.page.ts                # Chat/conversational interface
│   ├── timeline.page.ts            # Timeline/notifications page
│   └── ...
├── test-inputs/                    # Test data organized by business area
│   ├── queries.ts                  # GraphQL queries and mutations
│   └── smallBusiness/US/Regular/   # US Small Business test data
│       ├── CompanySetup/
│       ├── Worker/
│       ├── Payroll/
│       └── ...
├── tests/                          # Test specifications
│   └── smallBusiness/US/Regular/   # Organized by feature/workflow
│       ├── CompanySetup/
│       ├── Associate/
│       ├── Payroll/
│       └── ...
├── utils/                          # Utility functions
│   ├── helpers.ts                  # General helper functions
│   ├── gql.ts                      # GraphQL client
│   ├── aws.ts                      # AWS integrations
│   ├── logger.ts                   # Logging utility
│   └── ...
├── constant.ts                     # Constants (JSON mappings, intents, addresses)
├── playwright.config.ts            # Playwright configuration
├── global.setup.ts                 # Global test setup
├── global.teardown.ts              # Global test teardown
└── package.json                    # Dependencies and scripts
```

---

## Quick Reference - Common Patterns

### How to Run Tests

```bash
# 1. Update .env file with your configuration
#    TAG=@companySetup
#    E_TESTS_ENV=DIT
#    E_TESTS_STATE=CA

# 2. Run tests
npm start
```

### Most Common Test Pattern

```typescript
test('Feature Test @tag', async ({ chatPage, loginPage, page }) => {
  // 1. Login
  await loginPage.login(loginCreds().username, loginCreds().password);

  // 2. Run conversation (intent + Q&A handled automatically)
  await chatPage.findNextQuestion({
    testData: await testDataFunction(page),
    conversation: 'intentKey', // e.g., 'hire', 'payroll', 'terminate'
  });

  // 3. Verify completion via timeline
  await timelinePage.checkForTimelineNotification({
    header: 'Expected notification text',
    type: 'Notification',
    polling: { interval: 30, attempts: 6 },
  });
});
```

### Key Methods to Know

- **`findNextQuestion({ testData, conversation })`** - Main method for conversational flows (recommended)
- **`giveIntentToGetExpectedConversation(key)`** - Triggers intent manually (use when not using findNextQuestion with conversation param)
- **`timelinePage.checkForTimelineNotification({ header, type })`** - Verify timeline notifications or start ToDo conversations
- **`gql.waitForEvent({ canonicals, eventStatus, time })`** - Verify backend GraphQL event completion (GQL instance required)

### Intent Keys Reference

Check `constant.ts` → `intents` object for all available keys:

- `'hire'`, `'terminate'`, `'payroll'`, `'balances'`, `'W4'`, `'compensationChange'`, `'locationCreate'`, `'timeTracking'`, etc.

### Test Data Management

Tests fetch JSON data from **QA.TestCase database** (DIT environment):

- Configure via `.env`: `TAG=@companySetup` or `TestCaseID=abc-123`
- Data fetched during global setup → saved to `test.json`
- Tests use `loadJSON()` to read data
- Falls back to default JSON files in repo
- See **Section 6: JSON TestCase Management** for details

---

## Key Concepts and Architecture

### 1. Page Object Model (POM)

The framework uses the Page Object Model pattern to separate test logic from page interactions.

**Base Page** (`page-objects/basePage.ts`):

- Provides common functionality for all pages
- Handles WebSocket message listening for real-time updates
- Manages conversation headers, e-bot messages, input payloads
- Contains locator factory for dynamic element location

**Specialized Pages**:

- `login.page.ts`: Authentication and user registration
- `chat.page.ts`: Conversational UI interactions with e-bot
- `timeline.page.ts`: Notifications and to-do items
- `company.page.ts`, `people.page.ts`, etc.: Domain-specific pages

Page specific changes and method should be stored here.

### 2. Controllers

Controllers encapsulate business logic for complex form interactions and workflows. They are called internally by `findNextQuestion()` via the `handleController()` method.

**How Controllers Work**:

- Controllers are invoked automatically by `findNextQuestion()` based on input type
- `handleController()` determines which controller method to call (text input, dropdown, date picker, etc.)
- Controllers handle the low-level UI interactions (filling forms, clicking buttons, selecting options)
- You typically don't call controllers directly; `findNextQuestion()` manages them

**Key Controllers**:

- `employeeController.ts`: Worker/employee form interactions
- `addressController.ts`: Address form handling
- `balanceController.ts`: Payroll balance management
- `payrollAccordionController.ts`: Payroll UI interactions
- `timesheetSubmitController.ts`: Time tracking submissions

**Example Controller Usage** (internal to findNextQuestion):

```typescript
// This happens automatically inside findNextQuestion()
await this.handleController(payload, answer, conversation);
// ↓
// Calls appropriate method based on payload.type:
// - TextInput → fills text field
// - Dropdown → selects option
// - DatePicker → enters date
// - etc.
```

These controllers are kept in separate files for better organization. They're used within `chat.page.ts` methods like `findNextQuestion()`, `handleController()`, etc.

### 3. Test Data Management

Test data is organized hierarchically and supports both JSON and TypeScript formats.

**Structure**:

```
test-inputs/
└── smallBusiness/
    └── US/
        └── Regular/
            ├── CompanySetup/
            │   ├── companySetup.json
            │   └── companySetup.data.ts
            ├── Worker/
            │   ├── workerHireW2.json
            │   └── workerHire_1099Ind.json
            └── ...
```

`test.data.ts`

- This is used to store questions along with answers that'll be asked in the chat conversation and test specific queries and methods if needed.

`test.json` (Generated from DB)

- This file is **auto-generated** during global setup by fetching test data from the `QA.TestCase` database
- It stores the complete test case JSON that tests use at runtime
- Acts as a fallback when DB data is not available (e.g., `@smoke` tests, local runs with `RUN_FROM_LOCAL=true`)
- The base/default JSON files in `test-inputs/` directories are used only when `test.json` is not generated from DB

**constant.ts**: Central mapping file

- `conversationHeaders`: Expected conversation UI headers (keyed by conversation name)
- `intents`: Maps intent keys to actual intent commands/strings used by the e-bot (e.g., `hire: 'hire'`, `payroll: '>>start payroll.run'`)
- `addresses`: State-specific addresses for testing
- `zipCode`: State-specific zip codes

### 4. Conversational Testing Pattern

The e-platform uses a conversational UI (chatbot-style). Tests interact by:

1. Providing intents via keys that map to actual intent values in `constants.intents`
2. Using `findNextQuestion()` to automatically handle the conversation flow
3. Framework matches questions from e-bot with testData and provides answers
4. Waiting for completion events/notifications

**Intent Mapping**: `giveIntentToGetExpectedConversation()` accepts a **key** (not raw intent). Key is looked up in `constants.intents` (e.g., `'hire'` → `'hire'`, `'payroll'` → `'>>start payroll.run'`)

**Common Intent Keys**: `hire`, `payroll`, `terminate`, `balances`, `W4`, `compensationChange`, `locationCreate`, `timeTracking`, `additionalCompany` (see `constant.ts`)

**Testing Patterns**:

```typescript
// Pattern A (Recommended): findNextQuestion with conversation
await chatPage.findNextQuestion({
  testData: await hire(page),
  conversation: 'hire',
});

// Pattern B: Manual intent then findNextQuestion
await chatPage.giveIntentToGetExpectedConversation('hire');
await chatPage.findNextQuestion({ testData: await hire(page) });

// Pattern C: Company setup with showStopper
await chatPage.findNextQuestion({
  testData: await companyData(page),
  showStopper: page.getByRole('button', { name: 'Roll!' }),
});
```

### 5. findNextQuestion() Method

The `findNextQuestion()` method is the core automation engine for conversational flows. It handles the complete conversation lifecycle automatically.

**Method Signature**:

```typescript
await chatPage.findNextQuestion({
  testData: Step[],           // Array of {question, answer} pairs
  conversation?: string,      // Optional: Intent key to trigger
  showStopper?: Locator,      // Optional: Stop when element visible
  pollingInterval?: number,   // Optional: Polling interval (default: 1 sec)
  maxAttempts?: number,       // Optional: Max attempts (default: 360)
});
```

**How it Works**:

1. **Trigger Intent** (if `conversation` provided): Calls `giveIntentToGetExpectedConversation(conversation)` on first attempt
2. **Monitor Messages**: Listens to WebSocket messages from e-bot
3. **Match Questions**: Finds matching question in `testData` array using regex
4. **Provide Answers**: Calls appropriate controller to fill form/input based on question type
5. **Continue Loop**: Repeats until conversation completes or `showStopper` visible
6. **Handle Controllers**: Automatically determines input type (text, dropdown, date, etc.) and calls correct handler

**When to Use showStopper**:

- Company setup flows (no explicit completion message)
- Flows that end with a specific button/UI element
- Example: `showStopper: page.getByRole('button', { name: 'Roll!' })`

**Best Practices**:

- Always use `findNextQuestion()` for conversational flows (don't manually loop through questions)
- Include `conversation` parameter to trigger intent automatically
- Test data questions should match e-bot messages closely
- Use dynamic functions for answers that change per test run

### 6. JSON TestCase Management

The framework uses a centralized database to manage test data, allowing tests to fetch their JSON configurations dynamically instead of hardcoding them in the repository.

**Database**: `QA.TestCase` table in DIT environment

**Database Schema** (QA.TestCase):

- TestCaseID (PK), Canonical, Title, Description, TestData (json), Tag, Automated
- LastTestedData, LastBuildStatus, TestCaseCategory, TransactionStart/EndDateTime

**Flow**:

1. **Global Setup**: `saveJsonToFileSync()` fetches data by TAG or TestCaseID → writes to `test.json`
2. **Query Priority**: TestCaseID (highest) > Tag, filters by `TransactionEndDateTime > now()`
3. **Test Execution**: `loadJSON()` reads `test.json` or falls back to default JSONs (skipped for `@smoke`)

**Key Functions** (`utils/helpers.ts`):

- `saveJsonToFileSync()` - Fetches from DB → saves to `test.json`
- `getTestJsonFromDB()` - Queries by TestCaseID/Tag
- `loadJSON()` - Loads `test.json` or fallback
- `useQADatabase(query)` - Executes SQL via GraphQL
- `getLastBuildJsonFromDB()` / `setLastBuildJsonFromDB()` - Build status tracking
- `deleteTempTestCase()` - Cleans temp cases

**Usage**:

```typescript
import { loadJSON } from '@utils/helpers';
const compJSON = (await loadJSON()) || companyDefaultJSON;
```

**.env Configuration**:

```bash
TAG=@companySetup,@workerHire    # Comma-separated
TestCaseID=TC001,TC002           # Highest priority
```

**Connection**: GraphQL `customSql` via `gqlHelper` (requires SSH tunnel, AWS creds). Only active records: `TransactionEndDateTime > now()`

**Notes**: `test.json` auto-deleted by `run.sh`. Smoke tests use default JSONs. Local runs with `RUN_FROM_LOCAL=true` skip DB

### 7. Metagen Database Sync

The framework supports bidirectional sync between metagen files and the QA.TestCase database.

**Workflow**:

1. Generate files: `/metagen` skill → `metagen/jsons/` + `metagen/metaJSON/`
2. Edit files locally
3. Sync back to DB: `bash utils/syncMetagenToDB.sh`
4. Changes reflected in database for all environments

**Manual Sync**:

```bash
# Dry-run (validation only, no database writes)
bash utils/syncMetagenToDB.sh --dry-run

# Production sync
bash utils/syncMetagenToDB.sh
```

**Automated Sync**:

- Jenkins automatically syncs metagen files to database when PR is merged to master
- Webhook triggered by Bitbucket PR merge event
- Runs before test execution

**File Structure Requirements**:

- Files must exist in both `metagen/jsons/` and `metagen/metaJSON/`
- Filenames must match exactly (based on Tag)
- Each file is a JSON array (typically 1 element)

**Sync Logic**:

- Looks up record by Tag: `SELECT * FROM QA.TestCase WHERE Tag='<tag>' AND TransactionEndDateTime > now()`
- If exists: UPDATE all fields (preserves TestCaseID and TransactionStartDateTime)
- If not exists: INSERT new record with generated UUID
- Sets TransactionEndDateTime to '9999-12-31' (active record)

**Field Mapping**:

- `metagen/jsons/@tag.json` content → TestData column (JSON string)
- `metagen/metaJSON/@tag.json` content → All other columns (TestCaseID, Canonical, Title, Description, Tag, Automated, LastBuildStatus, TestCaseCategory, timestamps)

**Multi-Tag Files**:

- Files like `@companySetup,@taxids,@w4tax.json` are stored as single DB record
- Tag field contains comma-separated values

**Use Cases**:

- Bulk update test data across all test cases
- Version control for test case metadata
- Share test data between team members
- Backup and restore test configurations

### 8. Environment Configuration

**Environments** (`config/default.js`): DEV (local), DIT, FIT, STG, SB, HF, PROD, PaaS

**Config**: Base URLs, AWS Cognito, GraphQL endpoints, SSH hosts, Proxy

**.env Variables**: `E_TESTS_ENV`, `E_TESTS_STATE`, `E_TESTS_COUNTRY`, `MODE`, `BROWSER_NAME`, `BUILD_NUMBER`, `TAG`

---

## GraphQL Integration

### GraphQL Client (`utils/API/gql.ts`)

Custom client for API testing, data verification, setup/teardown. Queries in `test-inputs/queries.ts`.

```typescript
const gql = new GQL(page);
const response = await gql.run(
  Queries.getCompanyInfo,
  { companyId: '12345' },
  'QUERY',
);
```

### waitForEvent() Method

The `waitForEvent()` method polls the database for GraphQL events and waits until they reach a specific status. This is crucial for verifying backend operations complete successfully.

**Method Signature**:

```typescript
await gql.waitForEvent({
  canonicals: string[],        // Array of event canonical names to check
  eventStatus?: string,        // Status to wait for (e.g., 'complete', 'failed')
  time?: string,               // Start time for event search (default: current day start)
  intervalTime?: number,       // Polling interval in seconds (default: 30)
  ignoreCanonicals?: string[], // Events to ignore during validation
  checkAllEvents?: boolean,    // If true, validates ALL client events (default: false)
});
```

**Parameters**:

- **`canonicals`**: Array of event names to check (e.g., `['company.initialize', 'worker.hire']`)
- **`eventStatus`**: Expected status for specified canonicals (typically `'complete'`)
- **`time`**: Start timestamp for event search - use `DateUtil.getFormattedUTCCurrentDateTime()`
- **`intervalTime`**: How often to poll in seconds (default: 30, commonly use 15 or 6)
- **`checkAllEvents`**:
  - `false` (default): Only checks events in `canonicals` array
  - `true`: Validates ALL client events, ensuring nothing failed

**Common Patterns**:

```typescript
const gql = new GQL(page);
const time = DateUtil.getFormattedUTCCurrentDateTime();

// Single event
await gql.waitForEvent({
  canonicals: ['company.initialize'],
  eventStatus: 'complete',
  time,
});

// Multiple events with full validation
await gql.waitForEvent({
  canonicals: ['company.configure', 'taxConfiguration.evaluate'],
  eventStatus: 'complete',
  intervalTime: 6,
  time,
  checkAllEvents: true,
});

// With ignored events
await gql.waitForEvent({
  canonicals: ['payroll.run'],
  ignoreCanonicals: ['notification.send'],
  time,
});
```

**Use after**: Company setup, worker hire, payroll processing, or any async backend operations

---

## AWS Integration

**Services**: Cognito (auth, registration), SSM (secrets, configs), SES (email reports)

**Key Functions** (`utils/aws.ts`): `registerAndLoginWithCognito()`, `getSSMParameter()`, `sendEmailWithSES()`

---

## Common Testing Patterns

### 1. User Registration and Login

```typescript
const loginPage = new LoginPage(page);
await loginPage.login(loginCreds().username, loginCreds().password);
// Or for new users: loginPage.registerAndLoginInWithCognito('testuser@example.com', undefined, true)
```

### 2. Company Setup

```typescript
await chatPage.findNextQuestion({
  testData: await companyData(page),
  showStopper: page.getByRole('button', { name: 'Roll!' }),
});
await chatPage.customChatButtonClicker('Roll!');
await gql.waitForEvent({
  canonicals: ['company.initialize'],
  eventStatus: 'complete',
  time,
});
```

### 3. Worker/Employee Hire

```typescript
await chatPage.findNextQuestion({
  testData: await hire(page),
  conversation: 'hire',
});
await timelinePage.checkForTimelineNotification({
  header: 'Employee hired',
  type: 'Notification',
  polling: { interval: 30, attempts: 6 },
});
```

### 4. Payroll & Event Validation

```typescript
await chatPage.findNextQuestion({
  testData: await payrollData(page),
  conversation: 'payroll',
});
await gql.waitForEvent({
  canonicals: ['payroll.run'],
  eventStatus: 'complete',
  time,
});
// For multiple events: checkAllEvents: true validates ALL client events
```

---

## Timeline Integration

### checkForTimelineNotification() Method

The `checkForTimelineNotification()` method checks for notifications or to-do items in the Timeline page. It supports polling for notifications and can automatically start conversations from to-do items.

**Method Signature**:

```typescript
await timelinePage.checkForTimelineNotification({
  header: string,                   // Required: Text to search for in notification/todo
  type: 'Notification' | 'ToDo',    // Required: Type of timeline item
  polling?: {                       // Optional: Retry configuration
    interval: number,                // Interval in SECONDS (default: 5)
    attempts: number                 // Max attempts (default: 3)
  },
  time?: Moment,                    // Optional: Only check notifications after this time
  download?: boolean,               // Optional: Download attached document
  downloadPrevious?: boolean,       // Optional: Download previous document
  conversation?: string             // Optional: Start conversation from ToDo (intent key)
});
```

**Parameters**:

- **`header`**: Text to search for in the timeline item (can be partial match)
- **`type`**:
  - `'Notification'`: Regular timeline notifications (read-only)
  - `'ToDo'`: To-do items that may require action
- **`polling`**:
  - `interval`: Time between retries in **SECONDS** (gets converted to milliseconds internally)
  - `attempts`: Maximum number of polling attempts
  - Default: `{ interval: 5, attempts: 3 }`
- **`time`**: Moment.js object for filtering notifications after specific time (use with `moment().tz('America/New_York')`)
- **`conversation`**: If provided with ToDo type, starts the conversation using this intent key

**Common Patterns**:

```typescript
// Check notification
await timelinePage.checkForTimelineNotification({
  header: 'Payment processed',
  type: 'Notification',
  polling: { interval: 30, attempts: 6 },
});

// With time filter
const nowTime = moment().tz('America/New_York');
await timelinePage.checkForTimelineNotification({
  header: 'Payroll processed',
  type: 'Notification',
  time: nowTime,
});

// Start ToDo conversation
await timelinePage.checkForTimelineNotification({
  header: 'Add previous payroll',
  type: 'ToDo',
  conversation: 'balances',
});

// Download document
await timelinePage.checkForTimelineNotification({
  header: 'Payment processed',
  type: 'Notification',
  download: true,
});
```

**Key Points**:

- Automatically navigates to Timeline page and polls for specified header
- `polling.interval` is in SECONDS (converted to ms internally)
- `conversation` with ToDo type clicks item and triggers intent
- `download: true` downloads attached documents
- Use `time` (Moment object) to filter notifications after specific time

---

## Helper Utilities

**Dynamic Data** (`utils/helpers.ts`): `dynamicSSN()`, `dynamicEIN()`, `dynamicITIN()`, `dynamicPhoneNumber()`, `dynamicCompanyName()`, `randomChars(n)`, `DateUtil`

**Address**: `getAddressFromENV()` - state-specific addresses/zip codes in `constant.ts`

**JSON**: `loadJSON('@companySetup')` - loads test data

---

## Writing Tests

### Test Structure

```typescript
test.describe('Feature Name', () => {
  test('Test Case Name @tag', async ({ chatPage, loginPage, page }) => {
    await test.step('Login', async () => {
      await loginPage.login(loginCreds().username, loginCreds().password);
    });

    await test.step('Conversation', async () => {
      await chatPage.findNextQuestion({
        testData: await testDataFunction(page),
        conversation: 'intentKey',
      });
    });

    await test.step('Verify', async () => {
      await timelinePage.checkForTimelineNotification({
        header: 'Expected text',
        type: 'Notification',
        polling: { interval: 30, attempts: 6 },
      });
    });
  });
});
```

### Test Data Structure

Test data = array of question/answer pairs matched against e-bot messages:

```typescript
export const hire = async (page: Page) => {
  const hireJSON = (await loadJSON()) || hireDefaultJSON;
  return [
    { question: 'Are you adding an employee...?', answer: hireJSON.agreement },
    { question: "What is person's date of hire?", answer: getHireDate() },
    { question: 'Social security number?', answer: dynamicSSN() },
    {
      question: 'What email...?',
      answer: evaluateInput('hire-<env>-<uni>@etest.com'),
    },
  ];
};
```

**Key Points**: Framework matches questions via regex (ignores whitespace/case). Answers can be static values, functions, or async functions. Use helpers: `dynamicSSN()`, `dynamicEIN()`, `dynamicPhoneNumber()`, `evaluateInput()` for templates (`<env>`, `<uni>`, `<date>`). Use `test.step()` for better reporting.

---

## Running Tests

### Recommended Way

**Always use `npm start`** which executes `run.sh`:

1. Update `.env` with configuration (TAG, E_TESTS_ENV, E_TESTS_STATE, BROWSER_NAME, TestCaseID)
2. Run `npm start`

```bash
# .env example
E_TESTS_ENV=DIT
E_TESTS_STATE=CA
TAG=@companySetup,@workerHire
TestCaseID=TC001,TC002  # Optional
BROWSER_NAME=chromium
MODE=WEB
```

**Why `npm start`?**

- Loads `.env` variables, cleans artifacts, processes TAG/TestCaseID (comma-separated)
- ❌ Don't use: `npx playwright test --grep=@smoke` (bypasses cleanup & env loading)
- ✅ Use: `npm start` after setting TAG in `.env`

### Alternative Scripts

```bash
npm run test              # Direct Playwright (not recommended)
npm run companysetup      # Specific test file
npm run format / lint     # Code quality
npm run updateDocs        # Generate TypeDoc

### Playwright Config

**Settings** (`playwright.config.ts`): 45min timeout, 4 workers, 0 retries, Chromium/Firefox/Webkit, iPhone 13 emulation (MODE=MOBILE), trace on failure, video all, screenshot on failure

---

## Important Files Reference

### Core Configuration
- `playwright.config.ts`: Playwright test runner configuration
- `config/default.js`: Multi-environment configuration
- `constant.ts`: Constants and mappings
- `.env`: Environment variables

### Key Utilities
- `utils/helpers.ts`: General helper functions
- `utils/gql.ts`: GraphQL client
- `utils/aws.ts`: AWS integrations
- `utils/logger.ts`: Logging
- `utils/locatorFactory.ts`: Dynamic locator generation

### Base Components
- `page-objects/basePage.ts`: Base page class
- `page-objects/login.page.ts`: Authentication
- `page-objects/chat.page.ts`: Conversational UI
- `controllers/employeeController.ts`: Employee form handling

### Test Data
- `test-inputs/queries.ts`: GraphQL queries
- `test-inputs/smallBusiness/US/Regular/`: Test data by feature
- `constant.ts`: JSON mappings and intents

---

## Coding Standards

**Naming**: camelCase (vars, functions, files), PascalCase (classes/interfaces), UPPER_CASE (constants)
**Type Safety**: Specify types, avoid `any`, use `const` (not `var`)
**Error Handling**: try-catch blocks, log with `logger.error()`
**Quality**: Single quotes, switch over repetitive if-else, TODO comments, JSDoc

---

## Troubleshooting

**SSH Tunnel**: Check VPN, SSH host in `config/default.js`, AWS credentials
**AWS Credentials**: Run `createAWSCredentialsAndSSHTunnel()`, check IAM roles, proxy
**Timeouts**: Increase in `playwright.config.ts`, check network/environment
**WebSocket**: Verify proxy, baseURL, environment status

---

## PaaS Mode

OAuth2 client credentials flow with certificate-based auth (.pem, .key). Usage: `MODE=PAAS E_TESTS_ENV=SB npm run test`

---

## Test Organization

**Regular** (`tests/smallBusiness/US/Regular/`): Company setup, Employee mgmt, Payroll, Tax, Time tracking, Banking
**Mutation** (`tests/smallBusiness/US/Mutations/`): Direct GraphQL testing (bypass UI)
**Indicative SE** (`tests/smallBusiness/US/indicativesSE/`): Self-employed, 1099 contractors
**PaaS** (`tests/smallBusiness/US/PaaS/`): Partner portal, API testing

---

## CI/CD Integration

**Jenkins**: Parallel execution, AWS SES reports, build tracking, JSON output
Job: `https://labs-jenkins.es.ad.adp.com/jenkins/job/QA-PLAYWRIGHT-AUTOMATION-pipeline-ecs/`

---

## Tips for Claude

### When Making Updates

1. **Always read files first**: Never propose changes without reading the file
2. **Understand the pattern**: This is a POM-based framework with controllers
3. **Follow existing patterns**: Look at similar tests before writing new ones
4. **Use constants**: Add new intents/headers to `constant.ts`
5. **Dynamic data**: Use helper functions for SSN, EIN, emails, etc.
6. **Environment awareness**: Check which environment tests will run in
7. **Test data**: Add new test data to appropriate `test-inputs/` subdirectory
8. **Intent keys**: When using `giveIntentToGetExpectedConversation()` or `findNextQuestion()` with `conversation` parameter, pass the **key** from `constants.intents`, not the raw intent string. Check `constant.ts` for available keys (e.g., 'hire', 'payroll', 'terminate', etc.)
9. **Prefer findNextQuestion**: Use `findNextQuestion({ testData, conversation })` instead of manually calling `giveIntentToGetExpectedConversation()` followed by form filling. It handles the entire flow automatically.
10. **Run tests properly**: Always use `npm start` after configuring `.env` file. Never use direct `npm run test` or `npx playwright test` commands as they bypass the cleanup and proper environment loading done by `run.sh`.
11. **Test data from DB**: Tests fetch JSON data from QA.TestCase database. Always use the pattern `const json = (await loadJSON()) || defaultJSON` in tests. The database is queried by TAG or TestCaseID during global setup, and data is saved to `test.json`.

### Common Tasks

**Add New Test**:
1. Create test file in appropriate `tests/` subdirectory
2. Add test data function in `test-inputs/` returning array of {question, answer} pairs
3. Update `constant.ts` if new intents/headers needed
4. Use `findNextQuestion()` with `conversation` parameter for the flow
5. Follow `test.describe()` and `test.step()` pattern for organization
6. Verify completion using timeline notifications or GraphQL events

**Add New Page Object**:
1. Extend `BasePage` class
2. Define locators in constructor
3. Create action methods for page interactions
4. Use `locatorFactory` for dynamic locators

**Add New Controller**:
1. Create controller in `controllers/` directory
2. Accept `Page` in constructor
3. Create methods for form filling logic
4. Use existing helper functions

**Update Configuration**:
1. Environment URLs: Update `config/default.js`
2. Constants: Update `constant.ts`
3. Environment variables: Update `.env`

---

## Claude Skills

Located in `.claude/skills/` directory.

### `/get-testcases` (aliases: `/gettestcases`, `/testcases`, `/search-tests`)

Interactive search from QA Database:
1. Choose search method: Canonical, Tag, Category, or Description/Title
2. Enter search term
3. View formatted results
4. Follow-up: View details, search again, export to JSON, or exit

**Use when**: Finding test cases interactively, exploring available tests, exporting data

See `.claude/skills/README.md` for details.

---

## Security

Never commit `.env`/secrets. Use AWS SSM for sensitive data. Rotate credentials. `.pem`, `.key` in `.gitignore`.

## Documentation

`npm run updateDocs` / `npm run openDocs` - Generate/view TypeDoc

## Contact

**Team**: Roll QA | **Repo**: `ssh://git@bitbucket.es.ad.adp.com:7999/il/adp-e-automation.git`

*Last Updated: 2026-01-28*
```
