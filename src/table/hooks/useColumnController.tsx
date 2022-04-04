/**
 * 自定义显示列控制器，即列配置
 */
import { computed, ref, SetupContext, toRefs, watch } from 'vue';
import { SettingIcon } from 'tdesign-icons-vue-next';
import intersection from 'lodash/intersection';
import Checkbox, {
  CheckboxGroup,
  CheckboxGroupValue,
  CheckboxOptionObj,
  CheckboxGroupChangeContext,
} from '../../checkbox';
import { DialogPlugin } from '../../dialog/plugin';
import { useTNodeDefault } from '../../hooks/tnode';
import { renderTitle } from './useTableHeader';
import { PrimaryTableCol, TdPrimaryTableProps } from '../type';
import { useConfig } from '../../config-provider/useConfig';
import useDefaultValue from '../../hooks/useDefaultValue';
import { getCurrentRowByKey } from '../utils';

export function getColumnKeys(columns: PrimaryTableCol[], keys: string[] = []) {
  for (let i = 0, len = columns.length; i < len; i++) {
    const col = columns[i];
    col.colKey && keys.push(col.colKey);
    if (col.children?.length) {
      // eslint-disable-next-line no-param-reassign
      keys = keys.concat(getColumnKeys(col.children, [...keys]));
    }
  }
  return keys;
}

export default function useColumnController(props: TdPrimaryTableProps, context: SetupContext) {
  const renderTNode = useTNodeDefault();
  const { classPrefix, global } = useConfig('table');
  const { columns, columnController, displayColumns } = toRefs(props);

  const enabledColKeys = computed(() => {
    const arr = (columnController.value?.fields || [...new Set(getColumnKeys(columns.value))] || []).filter((v) => v);
    return new Set(arr);
  });

  const keys = [...new Set(getColumnKeys(columns.value))];

  // 确认后的列配置
  const [tDisplayColumns, setTDisplayColumns] = useDefaultValue(
    displayColumns,
    props.defaultDisplayColumns || keys,
    props.onDisplayColumnsChange,
    'displayColumns',
  );
  // 弹框内的多选
  const columnCheckboxKeys = ref<CheckboxGroupValue>(displayColumns.value || props.defaultDisplayColumns || keys);

  const checkboxOptions = computed<CheckboxOptionObj[]>(() => getCheckboxOptions(columns.value));

  const intersectionChecked = computed(() => intersection(columnCheckboxKeys.value, [...enabledColKeys.value]));

  watch([displayColumns], ([val]) => {
    columnCheckboxKeys.value = val;
  });

  function getCheckboxOptions(columns: PrimaryTableCol[], arr: CheckboxOptionObj[] = []) {
    // 减少循环次数
    for (let i = 0, len = columns.length; i < len; i++) {
      const item = columns[i];
      if (item.colKey) {
        arr.push({
          label: () => renderTitle(context.slots, item, i),
          value: item.colKey,
          disabled: !enabledColKeys.value.has(item.colKey),
        });
      }
      if (item.children?.length) {
        getCheckboxOptions(item.children, arr);
      }
    }
    return arr;
  }

  const handleCheckChange = (val: CheckboxGroupValue, ctx: CheckboxGroupChangeContext) => {
    columnCheckboxKeys.value = val;
    const params = {
      columns: val,
      type: ctx.type,
      currentColumn: getCurrentRowByKey(columns.value, String(ctx.current)),
      e: ctx.e,
    };
    props.onColumnChange?.(params);
  };

  const handleClickAllShowColumns = (checked: boolean, ctx: { e: Event }) => {
    if (checked) {
      const newData = columns.value?.map((t) => t.colKey) || [];
      columnCheckboxKeys.value = newData;
      props.onColumnChange?.({ type: 'check', columns: newData, e: ctx.e });
    } else {
      const disabledColKeys = checkboxOptions.value.filter((t) => t.disabled).map((t) => t.value);
      columnCheckboxKeys.value = disabledColKeys;
      props.onColumnChange?.({ type: 'uncheck', columns: disabledColKeys, e: ctx.e });
    }
  };

  const handleToggleColumnController = () => {
    const dialogInstance = DialogPlugin.confirm({
      header: global.value.columnConfigTitleText,
      body: () => {
        const widthMode = columnController.value?.displayType === 'fixed-width' ? 'fixed' : 'auto';
        const checkedLength = intersectionChecked.value.length;
        const isCheckedAll = checkedLength === enabledColKeys.value.size;
        const isIndeterminate = checkedLength > 0 && checkedLength < enabledColKeys.value.size;
        const defaultNode = (
          <div
            class={[
              `${classPrefix.value}-table__column-controller`,
              `${classPrefix.value}-table__column-controller--${widthMode}`,
            ]}
          >
            <div class={`${classPrefix.value}-table__column-controller-body`}>
              {/* 请选择需要在表格中显示的数据列 */}
              <p class={`${classPrefix.value}-table__column-controller-desc`}>
                {global.value.columnConfigDescriptionText}
              </p>
              <div class={`${classPrefix.value}-table__column-controller-block`}>
                <Checkbox indeterminate={isIndeterminate} checked={isCheckedAll} onChange={handleClickAllShowColumns}>
                  {global.value.selectAllText}
                </Checkbox>
              </div>
              <div class={`${classPrefix.value}-table__column-controller-block`}>
                <CheckboxGroup
                  options={checkboxOptions.value}
                  {...(columnController.value?.checkboxProps || {})}
                  value={columnCheckboxKeys.value}
                  onChange={handleCheckChange}
                />
              </div>
            </div>
          </div>
        );
        return renderTNode('columnControllerContent', defaultNode);
      },
      confirmBtn: global.value.confirmText,
      cancelBtn: global.value.cancelText,
      width: 612,
      onConfirm: () => {
        setTDisplayColumns([...columnCheckboxKeys.value]);
        dialogInstance.hide();
      },
      onClose: () => {
        dialogInstance.hide();
      },
      ...(columnController.value?.dialogProps || {}),
    });
  };

  const renderColumnController = () => {
    return (
      <div class={`${classPrefix.value}-table__column-controller`}>
        <t-button theme="default" variant="outline" onClick={handleToggleColumnController}>
          <SettingIcon slot="icon" />
          {global.value.columnConfigButtonText}
        </t-button>
      </div>
    );
  };

  return {
    tDisplayColumns,
    columnCheckboxKeys,
    checkboxOptions,
    renderColumnController,
  };
}
