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
        oauthToken: cdk.SecretValue.secretsManager('github-access-token') as any,
      }),
      customRules: [
        {
          source: '/<*>',
          target: '/index.html',
          status: amplify.RedirectStatus.NOT_FOUND
        }
      ],
      environmentVariables: {
        AMPLIFY_MONOREPO_APP_ROOT: 'frontend',
        AMPLIFY_DIFF_DEPLOY: 'false'
      },
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        applications: [
          {
            frontend: {
              phases: {
                build: {
                  commands: []
                }
              },
              artifacts: {
                baseDirectory: '/',
                files: [
                  '**/*'
                ]
              },
              cache: {
                paths: []
              }
            },
            appRoot: 'frontend',
          }
        ]
      })
    });

    amplifyApp.addBranch('master');

    // create cognito to manage the clients auth
    const pool = new cognito.UserPool(this, 'WildRydesCognito', {
      userPoolName: 'wildrydes-userpool',
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      autoVerify: {
        email: true
      },
      email: cognito.UserPoolEmail.withCognito(),
      standardAttributes: {
        email: {
          required: true,
          mutable: false
        }
      }
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
