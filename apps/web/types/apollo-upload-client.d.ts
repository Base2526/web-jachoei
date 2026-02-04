declare module 'apollo-upload-client' {
  import { ApolloLink } from '@apollo/client/core';

  export interface UploadLinkOptions {
    uri?: string;
    fetch?: any;
    headers?: Record<string, string>;
    credentials?: string;
  }

  export function createUploadLink(options?: UploadLinkOptions): ApolloLink;
}
