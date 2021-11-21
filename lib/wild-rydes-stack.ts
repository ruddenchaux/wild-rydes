import * as cdk from '@aws-cdk/core';
import * as amplify from '@aws-cdk/aws-amplify';
import * as codebuild from '@aws-cdk/aws-codebuild';

export class WildRydesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const amplifyApp = new amplify.App(this, 'MyApp', {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: 'ruddenchaux',
        repository: 'wild-rydes',
        oauthToken: cdk.SecretValue.secretsManager('github-token') as any
      }),
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        frontend: {
          appRoot: "frontend",
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
      })
    });
  }
}
