# Amazon Lex와 ChatGPT를 이용한 Interactive Chat 구현하기

Amazon Lex는 애플리케이션에 대화형 인터페이스를 구축하는 서비스로서 어플리케이션이 대화형 인터페이스를 설계, 구축, 테스트, 배포할 수 있도록 자연어 모델을 사용하는 완전관리형 인공지능(Managed AI) 서비스 입니다. 이와같이 Amazon Lex로 만든 챗봇은 연속적인 대화를 주고받을 수 있도록 의도(Intent)를 파악하여, 해당 의도를 이행하는 데 필요한 정보를 사용자에게 표시할 수 있습니다. 하지만, Amazon Lex에서 파악되지 않은 의도에 대한 답변을 위하여, [Amazon Kendra](https://aws.amazon.com/ko/solutions/partners/quantiphi-lex-kendra/)를 사용할 수 있었는데, 2022년 11월에 [ChatGPT](https://openai.com/blog/chatgpt)가 출시되어 우수한 대화능력을 보여줌으로 인해 Lex와의 조화도 고려해 볼 수 있게 되었습니다.

여기에서 구현하는 Architecture는 아래와 같습니다. 

![image](https://user-images.githubusercontent.com/52392004/222934173-26d5bbf7-ade3-4293-b4de-5c1e99ff3d1e.png)

## Aamazon Lex의 구현

서울 리전은 Lex V1을 지원하지 않으므로, Lev V2를 이용하여야 합니다. Lex에 사용자의 입력을 메시지로 전송하기 위하여 Lex V2에서는 [RecognizeText](https://docs.aws.amazon.com/lexv2/latest/APIReference/API_runtime_RecognizeText.html)을 이용하므로, Lex Runtime V2 client를 아래와 같이 정의 합니다. 

```java
import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
```

Lambda는 event에서 text를 분리하여 아래와 같이 botAliasId, botId를 이용해 메시지를 전달하게 되며, Lex에서 전달한 응답에서 메시지를 추출하여 전달합니다. 

```java
const text = event.text;

let lexParams = {        
  botAliasId: process.env.botAliasId,
  botId: process.env.botId,
  localeId: process.env.localeId,
  text: text,
  sessionId: process.env.sessionId,
};
const lexClient = new LexRuntimeV2Client();
const command = new RecognizeTextCommand(lexParams);

const data = await lexClient.send(command);
const messages = data['messages'][0];
console.log('text: ', messages.content);

return {
  statusCode: 200,
  body: messages.content,
};
```


## ChatGPT AI를 위한 인터페이스

[2023년 3월에 ChatGPT API가 공식적으로 오픈](https://openai.com/blog/introducing-chatgpt-and-whisper-apis)되어서 Lex와 연동할 수 있게 되었습니다.

