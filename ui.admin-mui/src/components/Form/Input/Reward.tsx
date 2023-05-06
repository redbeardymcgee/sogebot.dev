import { RefreshTwoTone } from '@mui/icons-material';
import {
  CircularProgress, FormControl, FormHelperText,
  IconButton, InputAdornment, InputLabel,
  MenuItem, Select, Typography,
} from '@mui/material';
import capitalize from 'lodash/capitalize';
import orderBy from 'lodash/orderBy';
import React from 'react';

import { getSocket } from '../../../helpers/socket';
import { useTranslation } from '../../../hooks/useTranslation';

export const FormRewardInput: React.FC<{
  value?: string | null
  onChange?: (value: { id: string, name: string }) => void,
}> = ({
  value,
  onChange,
}) => {
  const { translate } = useTranslation();

  const [ propsValue, setPropsValue ] = React.useState(value || null);

  const [ progress, setProgress ] = React.useState(false);
  const [ rewards, setRewards ] = React.useState<{ id: string, name: string }[]>([]);

  const selectedReward = React.useMemo(() => {
    return rewards.find(o => o.id === propsValue);
  }, [ rewards, propsValue ]);

  const handleChange = React.useCallback((event: any) => {
    setPropsValue(event.target.value);
  }, []);

  const refreshRedeemedRewards = () => {
    setProgress(true);
    return new Promise<void>((resolve) => {
      getSocket('/core/events').emit('events::getRedeemedRewards', (err, redeems: { id: string, name: string }[]) => {
        if (err) {
          return console.error(err);
        }
        setRewards(orderBy(redeems, 'name', 'asc'));
        setProgress(false);
        resolve();
      });
    });
  };

  React.useEffect(() => {
    if (onChange && selectedReward) {
      onChange(selectedReward);
    }
  }, [ selectedReward, onChange ]);

  React.useEffect(() => {
    refreshRedeemedRewards();
  }, [ ]);

  return (<>
    <FormControl fullWidth>
      <InputLabel id="reward-label" shrink>{capitalize(translate('event'))}</InputLabel>
      <Select
        MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
        value={propsValue ?? ''}
        displayEmpty
        renderValue={(selected) => {
          if (selected === '') {
            return <em>-- Please select a custom reward --</em>;
          }

          if (progress) {
            return <Typography variant='body2'>Loading...</Typography>;
          }

          if (selectedReward) {
            return <Typography variant='body2'>
              <Typography component='span' sx={{
                px: 0.5, fontWeight: 'bold',
              }}>{selectedReward.name}</Typography>
              <small>{selectedReward.id}</small>
            </Typography>;
          } else {
            return <Typography variant='body2'>
              Unknown reward selected, reward probably doesn't exist anymore
            </Typography>;
          }
        }}
        labelId="reward-label"
        id="demo-simple-select"
        label={capitalize(translate('event'))}
        onChange={handleChange}
        endAdornment={<InputAdornment position="end" sx={{ pr: 3 }}>
          <IconButton disabled={progress} onClick={refreshRedeemedRewards}>
            { progress
              ? <CircularProgress size={24}/>
              : <RefreshTwoTone/>
            }
          </IconButton>
        </InputAdornment>}
      >
        <MenuItem disabled value="">
          <em>-- Please select a custom reward --</em>
        </MenuItem>
        {rewards.map(reward => <MenuItem value={reward.id}>
          <Typography variant='body2'>
            <Typography component='span' sx={{
              px: 0.5, fontWeight: 'bold',
            }}>{reward.name}</Typography>
            <small>{reward.id}</small>
          </Typography>
        </MenuItem>)}
      </Select>
      <FormHelperText>
        {translate('events.myRewardIsNotListed')}
        {' '}
        {translate('events.redeemAndClickRefreshToSeeReward')}
      </FormHelperText>
    </FormControl>
  </>
  );
};