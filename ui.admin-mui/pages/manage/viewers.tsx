import {
  FilteringState,
  IntegratedSelection,
  RowDetailState,
  SelectionState,
  Sorting,
  SortingState,
} from '@devexpress/dx-react-grid';
import {
  Grid as DataGrid,
  Table,
  TableColumnVisibility,
  TableHeaderRow,
  TableRowDetail,
  TableSelection,
} from '@devexpress/dx-react-grid-material-ui';
import type { UserInterface } from '@entity/user';
import {
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Chip from '@mui/material/Chip';
import { grey } from '@mui/material/colors';
import { useRouter } from 'next/router';
import { useSnackbar } from 'notistack';
import {
  ReactElement, useCallback, useEffect, useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import SimpleBar from 'simplebar-react';
import { v4 } from 'uuid';

import { NextPageWithLayout } from '~/pages/_app';
import { ConfirmButton } from '~/src/components/Buttons/ConfirmButton';
import { ButtonsDeleteBulk } from '~/src/components/Buttons/DeleteBulk';
import { GridActionAliasMenu } from '~/src/components/GridAction/AliasMenu';
import { Layout } from '~/src/components/Layout/main';
import { BoolTypeProvider } from '~/src/components/Table/BoolTypeProvider';
import { RowDetail } from '~/src/components/Table/Viewers/RowDetail';
import { dayjs } from '~/src/helpers/dayjsHelper';
import { getSocket } from '~/src/helpers/socket';
import { useColumnMaker } from '~/src/hooks/useColumnMaker';
import { useFilter } from '~/src/hooks/useFilter';
import { setBulkCount } from '~/src/store/appbarSlice';

const PageManageViewers: NextPageWithLayout = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { configuration } = useSelector((state: any) => state.loader);

  const [ items, setItems ] = useState<UserInterface[]>([]);
  const [ loading, setLoading ] = useState(true);
  const { bulkCount } = useSelector((state: any) => state.appbar);
  const [ selection, setSelection ] = useState<(string|number)[]>([]);

  const [sorting, setSorting] = useState<Sorting[]>([{
    columnName: 'userName', direction: 'asc',
  }]);

  type extension = {
    userIdAndName: string;
    level: number;
    watchedTime: number;
    sumBits: number;
    sumTips: number;
  };
  const { useFilterSetup, columns, tableColumnExtensions, sortingTableExtensions, defaultHiddenColumnNames } = useColumnMaker<UserInterface & extension>([
    {
      columnName: 'userName', filtering: { type: 'string' }, hidden: true, translationKey: 'username',
    },
    {
      columnName: 'userId', filtering: { type: 'string' }, hidden: true, translation: 'User ID',
    },
    {
      columnName:     'userIdAndName',
      translationKey: 'username',
      column:         {
        getCellValue: (row) => {
          return (
            <>
              <Typography>{row.userName}</Typography>
              <Typography variant="caption" color={grey[500]}>{row.userId}</Typography>
              <div>
                {row.isSubscriber === true && <Chip label="subscriber" color="success" size="small" variant="outlined"/>}
                {row.isVIP === true && <Chip label="VIP" color="success" size="small" variant="outlined" />}
              </div>
            </>);
        },
      },
    },
    {
      columnName: 'isSubscriber', filtering: { type: 'boolean' }, hidden: true, translation: 'Subscriber',
    },
    {
      columnName: 'isVIP', filtering: { type: 'boolean' }, hidden: true, translation: 'VIP',
    },
    {
      columnName: 'messages', filtering: { type: 'number' }, table: { align: 'right' },
    },
    {
      columnName: 'level', table: { align: 'right' },
    },
    {
      columnName: 'points', filtering: { type: 'number' }, table: { align: 'right' },
    },
    {
      columnName:     'watchedTime',
      translationKey: 'watched-time',
      filtering:      { type: 'number' },
      table:          { align: 'right' },
      column:         {
        getCellValue: (row) => {
          return (
            <span>{(row.watchedTime / 1000 / 60 / 60).toFixed(2)}h</span>
          );
        },
      },
    },
    {
      columnName:     'seenAt',
      translationKey: 'last-seen',
      column:         {
        getCellValue: (row) => {
          return (
            row.seenAt && <span>{ dayjs(row.seenAt).format('LL') } { dayjs(row.seenAt).format('LTS') }</span>
          );
        },
      },
    },
    {
      columnName:     'subscribedAt',
      translationKey: 'subscribed-since',
      column:         {
        getCellValue: (row) => {
          return (
            row.subscribedAt && <span>{ dayjs(row.subscribedAt).format('LL') } { dayjs(row.subscribedAt).format('LTS') }</span>
          );
        },
      },
    },
    {
      columnName:     'sumTips',
      table:          { align: 'right' },
      translationKey: 'tips',
      column:         {
        getCellValue: (row) => {
          return (
            <span>{ Intl.NumberFormat(configuration.lang, {
              style: 'currency', currency: configuration.currency,
            }).format(row.sumTips || 0) }</span>
          );
        },
      },
    },
    {
      columnName: 'sumBits', table: { align: 'right' }, translationKey: 'bits',
    },
    {
      columnName: 'giftedSubscribes', filtering: { type: 'number' }, table: { align: 'right' }, translationKey: 'subgifts',
    },
    {
      columnName: 'subscribeCumulativeMonths', filtering: { type: 'number' }, table: { align: 'right' }, translationKey: 'subCumulativeMonths',
    },
    {
      columnName: 'subscribeStreak', filtering: { type: 'number' }, table: { align: 'right' }, translationKey: 'subStreak',
    },
    {
      columnName:  'actions',
      table:       { width: 130 },
      sorting:     { sortingEnabled: false },
      translation: ' ',
      column:      {
        getCellValue: (row) => [
          <Stack direction="row" key="row">
            <GridActionAliasMenu key='delete' onDelete={() => deleteItem(row)} />
          </Stack>,
        ],
      },
    },
  ]);

  const { element: filterElement, filters } = useFilter<UserInterface>(useFilterSetup);

  const deleteItem = useCallback((item: UserInterface) => {
    getSocket('/core/users').emit('viewers::remove', item.userId, () => {
      enqueueSnackbar(`User ${item.userName}#${item.userId} deleted successfully.`, { variant: 'success' });
      refresh();
    });
  }, [ enqueueSnackbar ]);

  useEffect(() => {
    refresh().then(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    setLoading(true);
    console.log({
      sorting, filters,
    });
    refresh({
      order: sorting, filter: filters,
    }).then(() => setLoading(false));
    setLoading(false);
  }, [sorting, filters]);

  const refresh = async ({ order, filter }: {order?: Sorting[], filter?: any[]} = {}) => {
    await Promise.all([
      new Promise<void>(resolve => {
        const sortTable = order ? {
          orderBy: order[0].columnName, sortOrder: order[0].direction.toUpperCase() as 'ASC' | 'DESC',
        } : undefined;

        if (sortTable && sortTable.orderBy === 'userIdAndName') {
          sortTable.orderBy = 'userName';
        }

        getSocket('/core/users').emit('find.viewers', {
          state: v4(),
          order: sortTable,
          filter,
        }, (err, items_) => {
          console.log({
            err, items_,
          });
          if (err) {
            console.error(err);
            resolve();
            return;
          }

          setItems(items_);
          resolve();
        });
      }),
    ]);
  };

  useEffect(() => {
    dispatch(setBulkCount(selection.length));
  }, [selection, dispatch]);

  const bulkDelete =  useCallback(async () => {
    for (const selected of selection) {
      const item = items.find(o => o.userId === selected);
      if (item) {
        await new Promise<void>((resolve, reject) => {
          getSocket('/core/users').emit('viewers::remove', item.userId, (err) => {
            if (err) {
              reject(console.error(err));
            }
            resolve();
          });
        });
      }
    }
    setItems(i => i.filter(item => !selection.includes(item.userId)));
    enqueueSnackbar(`Bulk operation deleted items.`, { variant: 'success' });
    setSelection([]);
  }, [ selection, enqueueSnackbar, items ]);

  const resetPoints = () => {
    getSocket('/core/users').emit('viewers::resetPointsAll', () => {
      refresh();
    });
  };

  const resetWatchedTime = () => {
    getSocket('/core/users').emit('viewers::resetWatchedTimeAll', () => {
      refresh();
    });
  };

  const resetMessages = () => {
    getSocket('/core/users').emit('viewers::resetMessagesAll', () => {
      refresh();
    });
  };

  const resetBits = () => {
    getSocket('/core/users').emit('viewers::resetBitsAll', () => {
      refresh();
    });
  };

  const resetTips = () => {
    getSocket('/core/users').emit('viewers::resetTipsAll', () => {
      refresh();
    });
  };

  const resetSubgifts = () => {
    getSocket('/core/users').emit('viewers::resetSubgiftsAll', () => {
      refresh();
    });
  };

  return (
    <>
      <Grid container sx={{ pb: 0.7 }} spacing={1} alignItems='center'>
        <Grid item>
          <Alert severity="info" sx={{ padding: 0 }}>Not all users are being shown, use filtering to search for users!</Alert>
        </Grid>
        <Grid item>
          <ConfirmButton handleOk={() => resetTips()}>Reset Tips</ConfirmButton>
          <ConfirmButton handleOk={() => resetBits()}>Reset Bits</ConfirmButton>
          <ConfirmButton handleOk={() => resetSubgifts()}>Reset subgifts</ConfirmButton>
          <ConfirmButton handleOk={() => resetPoints()}>Reset Points</ConfirmButton>
          <ConfirmButton handleOk={() => resetWatchedTime()}>Reset Watched Time</ConfirmButton>
          <ConfirmButton handleOk={() => resetMessages()}>Reset Messages</ConfirmButton>
        </Grid>
        <Grid item>
          <ButtonsDeleteBulk disabled={bulkCount === 0} onDelete={bulkDelete}/>
        </Grid>
        <Grid item>{filterElement}</Grid>
        <Grid item>
          {bulkCount > 0 && <Typography variant="button" px={2}>{ bulkCount } selected</Typography>}
        </Grid>
      </Grid>

      {loading
        ? <CircularProgress color="inherit" sx={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, 0)',
        }} />
        : <Paper>
          <SimpleBar style={{ maxHeight: 'calc(100vh - 116px)' }} autoHide={false}>
            <DataGrid
              rows={items}
              columns={columns}
              getRowId={row => row.userId}
            >
              <BoolTypeProvider
                for={['tickOffline', 'isEnabled']}
              />

              <RowDetailState/>
              <SortingState
                sorting={sorting}
                onSortingChange={setSorting}
                columnExtensions={sortingTableExtensions}
              />

              <FilteringState filters={filters}/>
              <SelectionState
                selection={selection}
                onSelectionChange={setSelection}
              />

              <IntegratedSelection/>
              <Table columnExtensions={tableColumnExtensions}/>
              <TableHeaderRow showSortingControls/>
              <TableRowDetail
                contentComponent={RowDetail}
              />
              <TableColumnVisibility
                defaultHiddenColumnNames={defaultHiddenColumnNames}
              />
              <TableSelection showSelectAll/>
            </DataGrid>
          </SimpleBar>
        </Paper>}
    </>
  );
};

PageManageViewers.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
      {page}
    </Layout>
  );
};

export default PageManageViewers;
