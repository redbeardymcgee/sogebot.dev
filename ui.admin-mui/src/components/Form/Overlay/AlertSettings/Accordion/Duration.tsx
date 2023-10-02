import { ExpandMoreTwoTone } from '@mui/icons-material';
import {
  Accordion, AccordionDetails, AccordionProps, AccordionSummary, Fade, InputAdornment, Typography,
} from '@mui/material';
import React from 'react';
import shortid from 'shortid';

import { FormNumericInput } from '../../../Input/Numeric';

type Props = Omit<AccordionProps, 'children' | 'onChange'> & {
  model: number,
  open: string,
  label?: string,
  max?: number,
  onOpenChange: (value: string) => void;
  onChange: (value: number) => void;
  customLabelDetails?: React.ReactNode;
  hideEndAdornment?: boolean;
  helperText?: string;
};

export const AccordionDuration: React.FC<Props> = (props) => {
  const [ accordionId ] = React.useState(shortid());
  const { open,
    onOpenChange,
    onChange,
    model,
    label,
    max,
    ...accordionProps } = props;

  const handleClick = () => {
    onOpenChange(open === accordionId ? '' : accordionId);
  };

  return <Accordion {...accordionProps} expanded={open === accordionId && !props.disabled}>
    <AccordionSummary
      expandIcon={<ExpandMoreTwoTone />}
      onClick={() => handleClick()}
      aria-controls="panel1a-content"
      id="panel1a-header"
    >
      <Typography sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%',
      }}>
        {label ? label : 'Duration'}
        <Fade in={open !== accordionId}>
          <Typography component='span' variant='caption' sx={{ textAlign: 'right' }}>
            {props.customLabelDetails
              ? props.customLabelDetails
              : <>{model / 1000}s</>
            }
          </Typography>
        </Fade>
      </Typography>
    </AccordionSummary>
    <AccordionDetails>
      <FormNumericInput
        fullWidth
        min={0}
        value={model}
        helperText={props.helperText}
        InputProps={!props.hideEndAdornment ? { endAdornment: <InputAdornment position='end'>ms</InputAdornment> } : undefined}
        onChange={val => {
          onChange(Number(val));
        }}
      />
    </AccordionDetails>
  </Accordion>;
};