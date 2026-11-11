import { FormNotice } from '@/components/form-notice/form-notice';

export default function FormNotFound() {
  return (
    <FormNotice title="This form isn't available">
      <p>
        The link may have been removed or replaced. Please contact the organisation that sent it to
        you for an up-to-date link.
      </p>
    </FormNotice>
  );
}
