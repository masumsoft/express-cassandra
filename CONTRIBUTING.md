## Contributing to Express Cassandra

If you have a question about express-cassandra (not a bug report) or having trouble using it, please post your question to [StackOverflow](http://stackoverflow.com/questions/tagged/express-cassandra).

### Reporting bugs

- Before opening a new issue, look for existing [issues](https://github.com/masumsoft/express-cassandra/issues) to avoid duplication. If the issue does not yet exist, then [create one](https://github.com/masumsoft/express-cassandra/issues/new).
  - Please post any relevant code samples, preferably a standalone script that
  reproduces your issue. Do **not** describe your issue in prose, keep structure and show your
  code.
  - If the bug involves an error, please post the stack trace.
  - Please mention the version of express-cassandra and cassandra that you're using.
  - For elassandra or janusgraph related issues, please mention the respective versions.
  - Please write bug reports in JavaScript (ES5 or ES2015), not coffeescript, typescript, etc.

### Requesting new features or enhancements

- Before opening a new issue, look for existing [issues](https://github.com/masumsoft/express-cassandra/issues) to avoid duplication. If the issue does not yet exist, [create one](https://github.com/masumsoft/express-cassandra/issues/new).
- Please describe a use case for it
- it would be ideal to include test cases as well

### Fixing bugs / Adding features

- Before starting to write code, look for existing [issues](https://github.com/masumsoft/express-cassandra/issues). That way you avoid working on something that might not be of interest or that has been addressed already in a different branch. You can create a new issue [here](https://github.com/masumsoft/express-cassandra/issues/new). If you like to work on an already open issue, then please let us know by commenting on that issue, so we can keep track of the progress and avoid multiple people working on the same problem.
  - _The source of this project is written in javascript, not coffeescript/typescript, therefore your bug reports should be reported using javascript_.
- Fork the [repo](https://github.com/masumsoft/express-cassandra) _or_ for small documentation changes, navigate to the source on github and click the [Edit](https://github.com/blog/844-forking-with-the-edit-button) button.

### Coding Convention and Linting

- Follow the general coding style of the rest of the project. We use [eslint](https://eslint.org/) and follow the [airbnb presets](https://github.com/airbnb/javascript/tree/eslint-config-airbnb-base-v12.1.0) for javascript coding style with some configured [exceptions](https://github.com/masumsoft/express-cassandra/blob/master/.eslintrc).
- Make sure your code passes the eslint coding convention and linting test. To see if your code has any linting errors, execute the `npm run lint` command.


### Running the tests
- Write tests and make sure they pass (tests are in the [test](https://github.com/masumsoft/express-cassandra/tree/master/test) directory).
- Open a terminal and navigate to the root of the project
- Execute `npm install` to install the necessary dependencies
- Download the preconfigured [elassandra+janusgraph](https://www.dropbox.com/s/vebuzbdql0w6eap/elassandra_janusgraph_distribution.zip?dl=1) for running tests. Some of the test cases require configuration changes in cassandra, elassandra and janusgraph. [Elassandra](http://www.elassandra.io/) and [JanusGraph](http://janusgraph.org/) is required for test cases that are related to supporting them.
- Start the elassandra instance
- Start the janusgraph instance
- Now execute `npm test` to run the tests (we're using [mocha](http://mochajs.org/))

### Writing Documentation

To contribute to the [documentation](http://express-cassandra.readthedocs.io/) just make your changes to the relevant `*.md` file in the [docs](https://github.com/masumsoft/express-cassandra/tree/master/docs) directory in the master branch and submit a [pull request](https://help.github.com/articles/using-pull-requests/). You might also use the github [Edit](https://github.com/blog/844-forking-with-the-edit-button) button.
