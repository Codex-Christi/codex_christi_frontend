// For ES6
import { SendMailClient } from 'zeptomail';
import { Sendmail } from 'zeptomail';

const url = 'https://api.zeptomail.com/v1.1/email';
const token = process.env.CODEX_PRIMARY_MAIL_AGENT_TOKEN!;

if (!token) {
  throw new Error('Missing CODEX_PRIMARY_MAIL_AGENT_TOKEN');
}

// Instantiate Mail sender client here
const client = new SendMailClient({ url, token });

interface SendMailFromPrimaryAgentProps {
  emailReceipents: Sendmail['to'];
  subject: string;
  htmlbody: string;
  textbody?: string;
  senderName?: string;
}

export type EmailSendErrResp = {
  error: {
    code: string;
    details: {
      code: string;
      message: string;
    }[];
    message: string;
  };
};

export interface EmailSendSuccessResp {
  data: {
    code: string;
    additional_info: [] | string[] | undefined;
    message: string;
  }[];
  message: string;
  request_id: string;
  object: string;
}

export const sendMailFromPrimaryAgent = async (props: SendMailFromPrimaryAgentProps) => {
  const { emailReceipents, subject, htmlbody, textbody, senderName = 'Codex Christi' } = props;

  return await client
    .sendMail({
      from: {
        address: 'noreply@codexchristi.org',
        name: senderName,
      },
      to: emailReceipents,
      subject: subject,
      htmlbody: htmlbody,
      ...(textbody === undefined ? {} : { textbody }),
    })
    .then((resp) => resp as EmailSendSuccessResp)
    .catch((err: EmailSendErrResp) => {
      throw err;
    });
};
