# Automation e-Platform

# Overview

This project is dedicated to building a robust automation testing framework for
our e-platforms utilizing [Playwright][playwright], a powerfull and versatile
end-to-end(E2E) testing tool. Our framework supports both E2E and unit testing,
ensurion comprehensive test coverage and enhancing the quality and reliability
of our application.

---

# Table of Contents

- [Project Structure](#markdown-header-project-structure)

- [Pre-requisites](#markdown-header-pre-requisites)

  - [brew](#markdown-header-brew)

  - [nvm](#markdown-header-nvm)

  - [node](#markdown-header-node)

  - [git](#markdown-header-git)

  - [ssh-key](#markdown-header-ssh-key)

- [Getting Started](#markdown-header-getting-started)

- [Coding Standards and Linting](#markdown-header-coding-standards-and-linting)
- [License](#markdown-header-license)

---

# Project Structure

- config/: Contains all the configs.

- controllers/: Contains all the controllers for each respective page.

- fixtures/: Shared setup and teardown logic for tests.

- page-objects/: Page Object Model (POM) classes representing different pages
  of the application.

- test-inputs/: Inputs for shared tests.

- tests/: Contains all test cases.

- utils/: Utility folder.

- package.json: THis file holds metadata relevant to the project and is where
  we manage dependencies and scripts.

- playwright.config.ts: Configuration file for customizing the Playwright test
  runner's behavior.

- tsconfig.json: This file specifies the root files and the compiler options.

---

# Pre-requisites:

- brew
- nvm
- node (~20)
- git
- bitbucket ssh-key set

## brew

Install [Homebrew][brew]:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## nvm

To install Node.js and npm, we need to first install the [nvm][nvm]:

```sh
brew install nvm
```

Now add configuration to your shell profile ( ~/.zshrc or ~/.bash_profile )
to use nvm:

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh"
[ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/usr/local/opt/nvm/etc/bash_completion.d/nvm"
```

## node

Install [Node][node] v20, preferably the 20 LTS version.

```sh
nvm install 20
nvm alias default 20
```

## git

Install [git][git]:

```sh
brew install git
```

## ssh-key

Set your SSH key in [Bitbucket][bit] so you can clone the repository via SSH.
Here is a comprehensive guide provided by them [macos-tutorial-ssh-key][tutorial-sshkey].

---

# Getting Started

1. Clone the repository, using ssh option:

```sh
ssh://git@bitbucket.es.ad.adp.com:7999/il/adp-e-automation.git
```

2. Install the dependencies:

```sh
npm i
```

3. Run Tests:

   - Via command line:

   ```sh
   npm run test
   ```

   - Via VSCode plugin:
     To use playwright via [VSCode Plugin][vsp] its recommended to follow the [this tutorial][vsp].

   ## Getting Started with Writing Tests

   To get started with writing tests for this project, take a look at the key points to get an overview:

   - **Organize your tests**: Store your test files in the `tests` directory to maintain a structured and manageable test suite.

   - **Manage test data**: Utilize the `test-inputs` file to store various types of test data, such as credentials and input answers for conversation flows. This allows for easy referencing and reusability of test data.

   - **Group and structure tests**: Group your tests using the `test.describe` function to organize and improve readability. Additionally, use the `test.step` function to further group tests and enhance the overall structure of your test report.

   - **Handle user inputs**: Use the `controller` function to handle user inputs during the conversation flow. This function allows you to provide answers, types, and questions, executing the necessary steps and submitting the inputs. You can loop this function with your test data to simulate a complete conversation.

   - **User authentication**: Simplify user authentication with the `registerAndLoginWithCognito` function. This function handles the registration and login process for a user, making it easier to set up the necessary authentication for your tests.

   - **Access environment variables**: using the `.env` file set your environment variables. The `baseURL` is already set for each test from env variables.

   - **Ensure clean conversation flow**: Use the `giveIntentToGetExpectedConversation` function to provide intents and cancel any existing conversations before starting a new one. This function helps ensure a clean and predictable conversation flow for your tests.

   - **Verify notifications and to-do items**: Utilize the `checkForTimelineNotification` function to verify notifications or start a to-do item based on the timeline. You can also use this function to wait for a specific to-do item to appear based on the footer time in the UI.

   - **Handle database events**: Use the `waitForEvent` function to handle the validation of events in DB. This function allows you to wait for specific events to move to expected eventStatus.

   - **Check for chat notifications**: Use the `checkChatNotification` function to check for new chat notifications. Additionally, you can use the `waitForNewElement` function to wait for a specific element to appear on the UI. This function is useful when you have multiple elements of the same type on the UI and you are expecting a new element to appear.

   - **Perform GQL calls**: Utilize the `queries.ts` file to access pre-defined GQL queries and mutations. Use the `run` method from `gql.ts` to execute your GQL calls and retrieve the response in JSON format. refer to `gql.spec.ts` file for example queries and mutations for reference.

   - **Refer to existing tests**: If needed, refer to existing tests that cover similar conversation flows for reference. This can provide insights and guidance when writing your own tests.

   Please note that the functions mentioned above may require further analysis and documentation based on their specific implementation and usage in your project.

# Coding Standards and Linting

Guidelines and best practices that help our team to write code that is consistent,
readable, and maintainable. Also checked by the lint.

## Running lint

```sh
npm run lint
```

> **_NOTE:_** fix found errors with the --fix flag

## Name Conventions

Always choose meaningfull and specific names.

1. ### Variable
   - Use "camelCase".
   - prefix booleans with "can", "is" or "has".
   ```ts
   firstName = 'John';
   ```
2. ### Method
   - Use "camelCase".
   ```ts
   function someMethodName() {}
   ```
3. ### Class/Interface
   - Use "PascalCase".
   ```ts
   interface WorkArea {}
   ```
4. ### Constant
   - Use UPPER*CASE with underscore "*" between multiple words.
   ```ts
   const E_BOT_FORMATED_NAME = 'e-bot';
   ```
5. ### File
   - Use "camelCase".
   ```sh
   employeeDetails.json
   ```

## Mention Data Types

Mention data types of variables

1. ### Variable Type

```ts
firstName: string;
```

2. ### Parameter Type

```ts
function someMethodName(a: number, b: number) {}
```

## Avoid "any" types

Avoid the use of type ‘any’. Create interface/class instead.

## Avoid "var" keyword.

Avoid the usage of 'var' keyword. Prefer the usage of 'const' and only use
'let' when strictly necessary.

## Avoid "if else"

Avoid using repetitive if else. Use switch case instead.

## Use "try catch"

Use try catch to handle the error and exceptions. Make sure there is no
unhandled exception in your code.

## Use single quotes

Use single quotes instead of double quotes for strings or constants or imports.

## Logging

Log errors and relevant information. This helps in debugging the code in case
of errors.

## TODOs

Add TODOs for pending code blocks. Also make sure to revisit and complete the
pending TODO code blocks.

```ts
function someMethodName() {
  // TODO
}
```

## What to do to have an up-to-date information in Docs?

Add the required comments for the code you are writing then run `npm run updateDocs`

## How to Open Docs?

Run `npm run openDocs`

[playwright]: https://playwright.dev/
[brew]: https://brew.sh/
[git]: https://git-scm.com/
[node]: https://nodejs.org/en
[nvm]: https://github.com/nvm-sh/nvm
[bit]: https://bitbucket.org/product/
[tutorial-sshkey]: https://support.atlassian.com/bitbucket-cloud/docs/set-up-personal-ssh-keys-on-macos/
[vsp]: https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright
