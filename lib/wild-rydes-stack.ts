import * as cdk from '@aws-cdk/core';
import * as amplify from '@aws-cdk/aws-amplify';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as cognito from '@aws-cdk/aws-cognito';

export class WildRydesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create amplify to host front end
    const amplifyApp = new amplify.App(this, 'WildRydes', {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: 'ruddenchaux',
        repository: 'wild-rydes',
        oauthToken: cdk.SecretValue.secretsManager('github-access-token') as any
      }),
      environmentVariables: {
        AMPLIFY_MONOREPO_APP_ROOT: 'frontend'
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '1.0',
        applications: [
          {
            appRoot: 'frontend',
            frontend: {
              phases: {
                build: {
                  commands: []
                }
              },
              artifacts: {
                baseDirectory: '/',
                files:
                - '**/*'
              }
            }
          }
        ]
      })
    });

    amplifyApp.addBranch('master');

    // create cognito to manage the clients auth
    const pool = new cognito.UserPool(this, 'WildRydesCognito', {
      userPoolName: 'wildrydes-userpool',
    });

    // create pool client
    const poolClient = pool.addClient('WildRydesWebApp', {
      generateSecret: false
    });

    // print the cognito pool id
    new cdk.CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });

    // print the cognito poll client id
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: poolClient.userPoolClientId });
  }
}
