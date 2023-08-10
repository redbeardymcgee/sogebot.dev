import Editor from '@monaco-editor/react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormLabel, Paper, PaperProps, Stack,
} from '@mui/material';
import { constrainedEditor } from 'constrained-editor-plugin/dist/esm/constrainedEditor';
import React from 'react';
import Draggable from 'react-draggable';

function PaperComponent(props: PaperProps) {
  return (
    <Draggable cancel={'[class*="MuiDialogContent-root"]'}>
      <Paper {...props} />
    </Draggable>
  );
}

type Props = {
  model: string,
  onChange(value: string): void,
};
export const HTMLDialog: React.FC<Props> = ({ onChange, model }) => {
  const [ open, setOpen ] = React.useState(false);

  const editorRef = React.useRef(null);
  function handleEditorDidMount(editor: any, monaco: any) {
    const restrictions = [];
    editorRef.current = editor;
    const constrainedInstance = constrainedEditor(monaco);
    const m = editor.getModel();
    constrainedInstance.initializeIn(editor);
    console.log({ model: [4, 1, model.split('\n').length + 2, model.split('\n')[model.split('\n').length - 1].length + 1] });
    restrictions.push({
      range:          [4, 1, model.split('\n').length + 2, model.split('\n')[model.split('\n').length - 1].length + 1],
      allowMultiline: true,
      label:          'code',
    });
    constrainedInstance.addRestrictionsTo(m, restrictions);
  }

  return <>
    <Stack direction='row' spacing={2} justifyContent='space-between' alignItems="center" sx={{ padding: '15px 20px 0px 0' }}>
      <FormLabel sx={{ width: '170px' }}>HTML</FormLabel>
      <Button onClick={() => setOpen(true)} variant='contained'>Edit</Button>
    </Stack>

    <Dialog
      fullWidth
      disableEnforceFocus
      style={{ pointerEvents: 'none' }}
      PaperProps={{ style: { pointerEvents: 'auto' } }}
      maxWidth='md'
      hideBackdrop
      PaperComponent={PaperComponent}
      onClose={() => setOpen(false)}
      open={open}>
      <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
        HTML
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Editor
          height="44vh"
          width="100%"
          language={'html'}
          defaultValue={`<html>
  <body id="#wrapper">
    ${model}
  </body>
</html>`}
          theme='vs-dark'
          onMount={handleEditorDidMount}
          onChange={() => {
            if (editorRef.current) {
              const editor = (editorRef.current as any).getModel();
              console.log({ editor });
              const values = editor.getValueInEditableRanges();
              onChange(values.code ?? '');
              console.log({ values });
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  </>;
};